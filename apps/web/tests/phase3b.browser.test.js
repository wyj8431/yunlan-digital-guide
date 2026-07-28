import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';
import { describe, it } from 'vitest';

const TARGET_URL =
  process.env.PHASE3B_BROWSER_URL ?? 'http://127.0.0.1:5175/?phase3b=voice-success';
const TARGET_ORIGIN = new URL(TARGET_URL).origin;
const WEB_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NPM_COMMAND = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const EDGE_EXECUTABLE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const SCENIC_AREA = {
  scenicArea: {
    id: 'wuzhen-scenic-area',
    name: '乌镇景区',
    description: '江南水乡古镇，适合漫游、乘船和夜游。',
    openingHours: '09:00-21:00',
    ticketInfo: '西栅成人票 150 元',
    location: '浙江省嘉兴市桐乡市'
  },
  spots: [{ id: 'west-gate', name: '西栅', summary: '水巷、桥梁和夜景。' }],
  routes: [
    {
      id: 'half-day',
      name: '西栅半日游',
      duration: '4 小时',
      description: '游客服务中心 -> 水上集市 -> 乌将军庙 -> 西栅夜景。'
    }
  ],
  services: [{ id: 'boat', name: '摇橹船', type: '交通', description: '景区内水上游览。' }],
  quickQuestions: ['请介绍一下乌镇景区']
};

const GUIDE_RESPONSE = {
  answer: '乌镇适合安排西栅半日游，建议傍晚入园并预留夜游时间。',
  cards: [
    {
      type: 'route-step',
      title: '西栅半日游',
      duration: '4 小时',
      description: '先游水巷，再看夜景。'
    }
  ],
  source: 'local-fallback',
  speechTimeline: {
    text: '乌镇适合安排西栅半日游，建议傍晚入园并预留夜游时间。',
    durationMs: 1600,
    visemes: [],
    source: 'estimated'
  },
  retrievedKnowledge: []
};

async function waitForServer(url, timeoutMs = 120000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (response.ok) {
        return true;
      }
    } catch {
      // Retry until the Vite server is ready.
    }

    await delay(500);
  }

  return false;
}

async function withDevServer(run) {
  if (process.env.PHASE3B_BROWSER_URL || (await waitForServer(TARGET_ORIGIN, 1000))) {
    return run();
  }

  const child = spawn(
    NPM_COMMAND,
    ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '5175', '--strictPort'],
    {
      cwd: WEB_DIR,
      stdio: 'inherit',
      shell: process.platform === 'win32'
    }
  );

  try {
    assert.ok(await waitForServer(TARGET_ORIGIN), `Timed out waiting for ${TARGET_ORIGIN}`);
    return await run();
  } finally {
    child.kill('SIGTERM');
  }
}

function browserLaunchOptions() {
  if (process.env.PHASE3B_BROWSER_EXECUTABLE) {
    return { executablePath: process.env.PHASE3B_BROWSER_EXECUTABLE, headless: true };
  }

  if (process.platform === 'win32') {
    return { executablePath: EDGE_EXECUTABLE_PATH, headless: true };
  }

  return { headless: true };
}

function installBrowserFakes(page) {
  return page.addInitScript(
    ({ response }) => {
      const mode = () =>
        new URL(window.location.href).searchParams.get('phase3b') ?? 'voice-success';
      const listeners = (target) => {
        target.__listeners = new Map();
        target.addEventListener = (type, handler) => {
          const handlers = target.__listeners.get(type) ?? [];
          handlers.push(handler);
          target.__listeners.set(type, handlers);
        };
        target.removeEventListener = (type, handler) => {
          const handlers = target.__listeners.get(type) ?? [];
          target.__listeners.set(
            type,
            handlers.filter((candidate) => candidate !== handler)
          );
        };
        target.__emit = (type, event = {}) => {
          for (const handler of target.__listeners.get(type) ?? []) {
            handler(event);
          }
        };
      };

      const track = {
        stop() {
          window.__phase3bTrackStops = (window.__phase3bTrackStops ?? 0) + 1;
        }
      };

      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: {
          getUserMedia: async () => {
            window.__phase3bGetUserMediaCalls = (window.__phase3bGetUserMediaCalls ?? 0) + 1;
            if (mode() === 'mic-denied') {
              throw new DOMException('Permission denied', 'NotAllowedError');
            }
            return { getTracks: () => [track] };
          }
        }
      });

      class FakeAudioWorklet {
        addModule() {
          return Promise.resolve();
        }
      }

      class FakeAudioNode {
        connect() {
          return this;
        }
        disconnect() {}
      }

      class FakeAudioBufferSource extends FakeAudioNode {
        onended = null;
        buffer = null;
        start() {
          setTimeout(() => this.onended?.(), 25);
        }
        stop() {
          this.onended?.();
        }
      }

      class FakeAudioContext {
        sampleRate = 48000;
        state = 'running';
        destination = {};
        audioWorklet = new FakeAudioWorklet();
        async resume() {
          this.state = 'running';
        }
        async close() {
          this.state = 'closed';
          window.__phase3bAudioCloses = (window.__phase3bAudioCloses ?? 0) + 1;
        }
        createMediaStreamSource() {
          return new FakeAudioNode();
        }
        createAnalyser() {
          return {
            fftSize: 2048,
            getByteTimeDomainData(buffer) {
              buffer.fill(128);
            }
          };
        }
        createBufferSource() {
          return new FakeAudioBufferSource();
        }
        async decodeAudioData() {
          return { duration: 0.15 };
        }
      }

      class FakeAudioWorkletNode extends FakeAudioNode {
        constructor() {
          super();
          this.port = {
            onmessage: null,
            close() {}
          };
          setTimeout(() => {
            const samples = new Float32Array(480);
            samples[0] = 0.2;
            this.port.onmessage?.({ data: samples.buffer });
          }, 50);
        }
      }

      window.AudioContext = FakeAudioContext;
      window.webkitAudioContext = FakeAudioContext;
      window.AudioWorkletNode = FakeAudioWorkletNode;

      class FakeSpeechSynthesisUtterance {
        constructor(text) {
          this.text = text;
          this.lang = 'zh-CN';
          this.rate = 1;
          this.pitch = 1;
          this.voice = null;
          this.onstart = null;
          this.onend = null;
          this.onerror = null;
        }
      }

      window.SpeechSynthesisUtterance = FakeSpeechSynthesisUtterance;
      window.speechSynthesis = {
        cancel() {},
        getVoices: () => [],
        speak(utterance) {
          setTimeout(() => utterance.onstart?.(), 0);
          setTimeout(() => utterance.onend?.(), 35);
        }
      };

      class FakeWebSocket {
        static CONNECTING = 0;
        static OPEN = 1;
        static CLOSING = 2;
        static CLOSED = 3;
        readyState = FakeWebSocket.CONNECTING;

        constructor(url) {
          this.url = url;
          window.__phase3bSocketUrls = window.__phase3bSocketUrls ?? [];
          window.__phase3bSocketUrls.push(url);
          listeners(this);
          setTimeout(() => {
            this.readyState = FakeWebSocket.OPEN;
            this.__emit('open');
          }, 0);
        }

        send(payload) {
          if (typeof payload !== 'string') {
            return;
          }

          const message = JSON.parse(payload);
          if (this.url.includes('/api/voice') && message.type === 'session.start') {
            this.emitVoiceEvents(message.sessionId);
            return;
          }

          if (this.url.includes('/api/guide/chat/stream') && message.type === 'ask') {
            this.emitGuideEvents();
          }
        }

        emit(type, event = {}) {
          this.__emit(type, event);
        }

        emitVoiceEvents(sessionId) {
          const sendEvent = (event, delayMs) => {
            setTimeout(() => {
              if (this.readyState !== FakeWebSocket.OPEN) {
                return;
              }
              this.emit('message', { data: JSON.stringify({ sessionId, ...event }) });
            }, delayMs);
          };

          sendEvent({ type: 'session.created', sequence: 1 }, 5);
          if (mode() === 'voice-failure') {
            setTimeout(() => this.close(), 20);
            return;
          }

          sendEvent({ type: 'transcript.partial', sequence: 2, text: '乌镇' }, 15);
          sendEvent({ type: 'transcript.final', sequence: 3, text: '请介绍一下乌镇景区' }, 25);
          sendEvent(
            {
              type: 'answer.final',
              sequence: 4,
              answer: response.answer,
              cards: response.cards
            },
            40
          );
          sendEvent({ type: 'transcript.final', sequence: 5, text: '请介绍一下乌镇景区' }, 45);
          sendEvent(
            {
              type: 'answer.final',
              sequence: 6,
              answer: response.answer,
              cards: response.cards
            },
            50
          );
          sendEvent({ type: 'response.done', sequence: 7 }, 65);
        }

        emitGuideEvents() {
          const send = (event, delayMs) => {
            setTimeout(() => this.emit('message', { data: JSON.stringify(event) }), delayMs);
          };
          send({ type: 'start' }, 0);
          send({ type: 'delta', delta: response.answer.slice(0, 8) }, 5);
          send({ type: 'delta', delta: response.answer.slice(8) }, 10);
          send({ type: 'result', response }, 15);
          send({ type: 'done' }, 20);
        }

        close() {
          if (this.readyState === FakeWebSocket.CLOSED) {
            return;
          }
          this.readyState = FakeWebSocket.CLOSED;
          this.emit('close');
        }
      }

      window.WebSocket = FakeWebSocket;
      window.__phase3bLocalStorageBefore = JSON.stringify({ ...localStorage });
      window.__phase3bIndexedDbWrites = 0;
      const originalSetItem = localStorage.setItem.bind(localStorage);
      localStorage.setItem = (key, value) => {
        window.__phase3bLocalStorageWrites = window.__phase3bLocalStorageWrites ?? [];
        window.__phase3bLocalStorageWrites.push({ key, value });
        return originalSetItem(key, value);
      };
      const originalOpen = indexedDB.open.bind(indexedDB);
      indexedDB.open = (...args) => {
        window.__phase3bIndexedDbWrites += 1;
        return originalOpen(...args);
      };
    },
    { response: GUIDE_RESPONSE }
  );
}

async function mockApi(page) {
  await page.route('**/api/scenic-area', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(SCENIC_AREA)
    })
  );
  await page.route('**/api/virtual-human/config', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        enabled: false,
        provider: 'three-fallback',
        reason: 'browser acceptance fallback'
      })
    })
  );
  await page.route('**/api/speech/synthesize', (route) =>
    route.fulfill({ status: 200, contentType: 'audio/mpeg', body: Buffer.from('fake-audio') })
  );
}

async function createPage(browser, scenario) {
  const page = await browser.newPage();
  await mockApi(page);
  await installBrowserFakes(page);
  await page.goto(`${TARGET_ORIGIN}/?phase3b=${scenario}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.guide-panel');
  await page.waitForSelector('input[aria-label="向数字导游提问"]');
  return page;
}

async function assertNoHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  assert.ok(overflow.scrollWidth <= overflow.clientWidth + 1, `${label}: horizontal overflow`);
}

async function assertVoiceAnswer(page) {
  await page.getByRole('button', { name: '语音输入' }).click();
  await page.waitForFunction(() => window.__phase3bGetUserMediaCalls === 1);
  assert.ok(
    (await page.evaluate(() => window.__phase3bSocketUrls ?? [])).some((url) =>
      url.includes(':8787/api/voice')
    ),
    'voice WebSocket should connect to the backend port'
  );
  await page.waitForFunction(() => document.querySelectorAll('.message-user').length === 1, null, {
    timeout: 10000
  });
  await page.waitForFunction(
    () =>
      document.querySelectorAll('.message-assistant').length === 1 &&
      document.querySelector('.message-assistant p')?.textContent?.includes('西栅半日游'),
    null,
    { timeout: 10000 }
  );

  assert.equal(await page.locator('.message-user').count(), 1);
  assert.equal(await page.locator('.message-assistant').count(), 1);
  assert.equal(await page.locator('.message-user p').textContent(), '请介绍一下乌镇景区');
  assert.equal(await page.locator('.message-assistant p').textContent(), GUIDE_RESPONSE.answer);

  const writes = await page.evaluate(() => ({
    localStorageWrites: window.__phase3bLocalStorageWrites ?? [],
    indexedDbWrites: window.__phase3bIndexedDbWrites ?? 0
  }));
  assert.equal(writes.indexedDbWrites, 0, 'voice data must not open IndexedDB');
  assert.ok(
    writes.localStorageWrites.every(
      ({ key, value }) => !/audio|record|transcript|voice|录音|转写/i.test(`${key} ${value}`)
    ),
    'raw voice data must not be written to localStorage'
  );
}

async function assertTextFallback(page) {
  const input = page.locator('input[aria-label="向数字导游提问"]');
  await page.waitForFunction(() => document.querySelector('.question-status')?.textContent);
  assert.equal(await input.isEnabled(), true);
  await input.fill('乌镇晚上适合怎么玩？');
  await page.getByRole('button', { name: '发送问题' }).click();
  assert.ok(
    (await page.evaluate(() => window.__phase3bSocketUrls ?? [])).some((url) =>
      url.includes(':8787/api/guide/chat/stream')
    ),
    'guide WebSocket should connect to the backend port'
  );
  await page.waitForFunction(
    () =>
      document.querySelectorAll('.message-user').length === 1 &&
      document.querySelectorAll('.message-assistant').length === 1,
    null,
    { timeout: 10000 }
  );
  assert.equal(await page.locator('.message-user p').textContent(), '乌镇晚上适合怎么玩？');
}

async function runBrowserAcceptance() {
  await withDevServer(async () => {
    const browser = await chromium.launch(browserLaunchOptions());

    try {
      const successPage = await createPage(browser, 'voice-success');
      await successPage.setViewportSize({ width: 1440, height: 900 });
      await assertVoiceAnswer(successPage);
      await assertNoHorizontalOverflow(successPage, 'desktop');
      await successPage.setViewportSize({ width: 390, height: 844 });
      await successPage.reload({ waitUntil: 'domcontentloaded' });
      await successPage.waitForSelector('.guide-panel');
      await assertNoHorizontalOverflow(successPage, 'mobile');
      await successPage.close();

      const failurePage = await createPage(browser, 'voice-failure');
      await failurePage.getByRole('button', { name: '语音输入' }).click();
      await failurePage.waitForFunction(
        () => document.querySelector('.question-status')?.textContent?.includes('断开'),
        null,
        { timeout: 10000 }
      );
      await assertTextFallback(failurePage);
      await failurePage.close();

      const deniedPage = await createPage(browser, 'mic-denied');
      await deniedPage.getByRole('button', { name: '语音输入' }).click();
      await deniedPage.waitForFunction(
        () => document.querySelector('.question-status')?.textContent?.includes('麦克风'),
        null,
        { timeout: 10000 }
      );
      await assertTextFallback(deniedPage);
      await deniedPage.close();
    } finally {
      await browser.close();
    }
  });
}

describe('phase 3B browser acceptance', () => {
  it('validates streaming voice submit, duplicate protection, privacy, fallback, and layout', async () => {
    await runBrowserAcceptance();
  }, 180000);
});
