import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';
import { describe, it } from 'vitest';

const MODE = process.env.PHASE3A_BROWSER_MODE ?? 'smoke';
const TARGET_URL =
  process.env.PHASE3A_BROWSER_URL ?? 'http://127.0.0.1:5174/lab/lip-sync?phase3a-debug=1';
const TARGET_ORIGIN = new URL(TARGET_URL).origin;
const WEB_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NPM_COMMAND = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const EDGE_EXECUTABLE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

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

    await delay(1000);
  }

  return false;
}

async function withDevServer(run) {
  if (process.env.PHASE3A_BROWSER_URL || (await waitForServer(TARGET_ORIGIN, 1000))) {
    return run();
  }

  const child = spawn(
    NPM_COMMAND,
    ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '5174', '--strictPort'],
    {
      cwd: WEB_DIR,
      stdio: 'inherit',
      shell: process.platform === 'win32'
    }
  );

  try {
    const ready = await waitForServer(TARGET_ORIGIN);
    assert.ok(ready, `Timed out waiting for ${TARGET_ORIGIN}`);
    return await run();
  } finally {
    child.kill('SIGTERM');
  }
}

function browserLaunchOptions() {
  if (process.env.PHASE3A_BROWSER_EXECUTABLE) {
    return {
      executablePath: process.env.PHASE3A_BROWSER_EXECUTABLE,
      headless: true
    };
  }

  if (process.platform === 'win32') {
    return {
      executablePath: EDGE_EXECUTABLE_PATH,
      headless: true
    };
  }

  return { headless: true };
}

function parsePngSamples(buffer) {
  const signature = buffer.subarray(0, 8).toString('hex');
  assert.equal(signature, '89504e470d0a1a0a', 'canvas screenshot is not a PNG');

  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idat = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
  }

  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
  assert.ok(channels > 0, `unsupported PNG color type ${colorType}`);

  const inflated = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const rows = [];
  let cursor = 0;
  let previous = Buffer.alloc(stride);

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[cursor];
    cursor += 1;
    const row = Buffer.from(inflated.subarray(cursor, cursor + stride));
    cursor += stride;

    for (let x = 0; x < row.length; x += 1) {
      const left = x >= channels ? row[x - channels] : 0;
      const up = previous[x] ?? 0;
      const upLeft = x >= channels ? previous[x - channels] : 0;

      if (filter === 1) {
        row[x] = (row[x] + left) & 0xff;
      } else if (filter === 2) {
        row[x] = (row[x] + up) & 0xff;
      } else if (filter === 3) {
        row[x] = (row[x] + Math.floor((left + up) / 2)) & 0xff;
      } else if (filter === 4) {
        const predictor = left + up - upLeft;
        const pa = Math.abs(predictor - left);
        const pb = Math.abs(predictor - up);
        const pc = Math.abs(predictor - upLeft);
        const paeth = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
        row[x] = (row[x] + paeth) & 0xff;
      }
    }

    rows.push(row);
    previous = row;
  }

  return rows.flatMap((row) => Array.from(row));
}

function isVerticalOverlap(first, second) {
  return first.y < second.y + second.height && first.y + first.height > second.y;
}

function isHorizontalOverlap(first, second) {
  return first.x < second.x + second.width && first.x + first.width > second.x;
}

function hasOverlap(first, second) {
  return isHorizontalOverlap(first, second) && isVerticalOverlap(first, second);
}

async function snapshotDebug(page) {
  return page.evaluate(() => window.__LIP_SYNC_DEBUG__ ?? null);
}

async function ensureCanvasVariance(page) {
  const screenshot = await page.locator('.lip-sync-stage canvas').screenshot();
  const samples = parsePngSamples(screenshot);
  assert.ok(new Set(samples).size > 1, 'Canvas screenshot should not be blank.');
}

async function clickPlay(page) {
  await page.locator('.lip-sync-toolbar button').nth(1).click();
}

async function waitForDebugField(page, field, timeoutMs = 15000) {
  await page.waitForFunction(
    (key) => Boolean(window.__LIP_SYNC_DEBUG__ && window.__LIP_SYNC_DEBUG__[key] !== null),
    field,
    { timeout: timeoutMs }
  );
  return snapshotDebug(page);
}

async function assertLayout(page, viewportLabel) {
  const rootRect = await page.locator('.lip-sync-lab').boundingBox();
  const toolbarRect = await page.locator('.lip-sync-toolbar').boundingBox();
  const controlsRect = await page.locator('.lip-sync-controls').boundingBox();
  const stageRect = await page.locator('.lip-sync-stage').boundingBox();
  const metricsRect = await page.locator('.lip-sync-metrics').boundingBox();

  assert.ok(rootRect, `${viewportLabel}: root rect missing`);
  assert.ok(toolbarRect, `${viewportLabel}: toolbar rect missing`);
  assert.ok(controlsRect, `${viewportLabel}: controls rect missing`);
  assert.ok(stageRect, `${viewportLabel}: stage rect missing`);
  assert.ok(metricsRect, `${viewportLabel}: metrics rect missing`);

  const rects = [toolbarRect, controlsRect, stageRect, metricsRect];

  for (let index = 0; index < rects.length; index += 1) {
    for (let next = index + 1; next < rects.length; next += 1) {
      assert.ok(!hasOverlap(rects[index], rects[next]), `${viewportLabel}: overlapping panels`);
    }
  }

  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));

  assert.ok(
    overflow.scrollWidth <= overflow.clientWidth,
    `${viewportLabel}: horizontal overflow detected`
  );
}

async function assertStageStableDuringSliderChanges(page) {
  const stage = page.locator('.lip-sync-stage');
  const sliders = page.locator('input[type="range"]');
  const before = await stage.boundingBox();

  assert.ok(before, 'stage rect missing before slider changes');

  const sliderCount = await sliders.count();

  for (let index = 0; index < sliderCount; index += 1) {
    await sliders.nth(index).evaluate((input, sliderIndex) => {
      const minimum = Number(input.min || '0');
      const maximum = Number(input.max || '1');
      const step = Number(input.step || '1');
      const midpoint = minimum + (maximum - minimum) / 2;
      const stepped = Math.round(midpoint / step) * step;
      input.value = String(sliderIndex % 2 === 0 ? maximum : stepped);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, index);
    const after = await stage.boundingBox();

    assert.deepStrictEqual(after, before, `stage moved while changing slider ${index + 1}`);
  }
}

async function assertRouteCleanup(page) {
  await page.goto(`${TARGET_ORIGIN}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => Number(sessionStorage.getItem('__phase3aAudioCloseCount__') ?? '0') > 0,
    null,
    { timeout: 5000 }
  );

  assert.equal(
    await page.locator('.lip-sync-stage canvas').count(),
    0,
    'Canvas should be removed.'
  );
}

async function smokeCheck(page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('.lip-sync-stage canvas');

  await ensureCanvasVariance(page);
  await clickPlay(page);

  const startSnapshot = await waitForDebugField(page, 'audioStartTimestamp');
  const responseSnapshot = await waitForDebugField(page, 'mouthResponseTimestamp');

  assert.ok(startSnapshot.audioStartTimestamp !== null, 'audio start timestamp missing');
  assert.ok(responseSnapshot.mouthResponseTimestamp !== null, 'mouth response timestamp missing');
  assert.ok(
    responseSnapshot.mouthResponseTimestamp - startSnapshot.audioStartTimestamp <= 200,
    'mouth response should start within 200ms of audio start'
  );

  await page.waitForFunction(
    () =>
      window.__LIP_SYNC_DEBUG__?.currentMouthOpen !== undefined &&
      window.__LIP_SYNC_DEBUG__?.currentMouthOpen < 0.01,
    null,
    { timeout: 15000 }
  );

  const settledSnapshot = await snapshotDebug(page);
  assert.ok(settledSnapshot.currentMouthOpen < 0.01, 'mouth should close after audio completes');

  await assertLayout(page, 'desktop');
  await assertStageStableDuringSliderChanges(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.lip-sync-stage canvas');
  await assertLayout(page, 'mobile');

  await assertRouteCleanup(page);
}

async function benchmarkSession(page, label, viewport, durationMs) {
  await page.setViewportSize(viewport);
  await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('.lip-sync-stage canvas');
  await clickPlay(page);

  const startSnapshot = await waitForDebugField(page, 'audioStartTimestamp');
  const responseSnapshot = await waitForDebugField(page, 'mouthResponseTimestamp');

  assert.ok(startSnapshot.audioStartTimestamp !== null, `${label}: audio start timestamp missing`);
  assert.ok(
    responseSnapshot.mouthResponseTimestamp !== null,
    `${label}: mouth response timestamp missing`
  );

  await page.waitForTimeout(durationMs);
  const finalSnapshot = await snapshotDebug(page);

  return {
    label,
    viewport: `${viewport.width}x${viewport.height}`,
    qualityTier: finalSnapshot.metrics.qualityTier,
    averageFps: finalSnapshot.metrics.averageFps,
    p95FrameMs: finalSnapshot.metrics.p95FrameMs,
    responseLatencyMs: responseSnapshot.mouthResponseTimestamp - startSnapshot.audioStartTimestamp,
    drawCalls: finalSnapshot.metrics.drawCalls,
    triangles: finalSnapshot.metrics.triangles,
    heapMb: finalSnapshot.metrics.heapMb,
    automaticDegradation: finalSnapshot.metrics.qualityTier !== 'high',
    mouthOpen: finalSnapshot.currentMouthOpen
  };
}

async function benchmarkCheck(page) {
  const results = [];

  for (let run = 1; run <= 3; run += 1) {
    results.push(
      await benchmarkSession(page, `desktop-${run}`, { width: 1440, height: 900 }, 60000)
    );
    await assertRouteCleanup(page);
  }

  for (let run = 1; run <= 3; run += 1) {
    results.push(await benchmarkSession(page, `mobile-${run}`, { width: 390, height: 844 }, 60000));
    await assertRouteCleanup(page);
  }

  const stability = await benchmarkSession(
    page,
    'stability-10m',
    { width: 1440, height: 900 },
    600000
  );
  await assertRouteCleanup(page);

  console.log(JSON.stringify({ results, stability }, null, 2));
}

async function runBrowserAcceptance() {
  await withDevServer(async () => {
    const browser = await chromium.launch(browserLaunchOptions());
    const page = await browser.newPage();

    try {
      await page.addInitScript(() => {
        const key = '__phase3aAudioCloseCount__';
        if (sessionStorage.getItem(key) === null) {
          sessionStorage.setItem(key, '0');
        }

        const patch = (ContextCtor) => {
          if (!ContextCtor || ContextCtor.prototype.__phase3aClosePatched) {
            return;
          }

          const originalClose = ContextCtor.prototype.close;
          ContextCtor.prototype.close = async function close(...args) {
            const count = Number(sessionStorage.getItem(key) ?? '0') + 1;
            sessionStorage.setItem(key, String(count));
            return originalClose.apply(this, args);
          };
          ContextCtor.prototype.__phase3aClosePatched = true;
        };

        patch(window.AudioContext);
        patch(window.webkitAudioContext);
      });

      if (MODE === 'bench') {
        await benchmarkCheck(page);
      } else {
        await smokeCheck(page);
      }
    } finally {
      await page.close();
      await browser.close();
    }
  });
}

describe('phase 3A browser acceptance', () => {
  it(
    'validates lip-sync rendering, response, layout, and cleanup',
    async () => {
      await runBrowserAcceptance();
    },
    MODE === 'bench' ? 1050000 : 180000
  );
});
