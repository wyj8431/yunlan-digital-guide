import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { describe, it } from 'vitest';

const ENABLED = process.env.RUN_EXHIBITION_PERFORMANCE === '1';
const WEB_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL = process.env.EXHIBITION_BROWSER_URL ?? 'http://127.0.0.1:5187/exhibition';
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function serverReady(timeout = 60_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      if ((await fetch(URL)).ok) return true;
    } catch {
      // Vite may still be starting.
    }
    await delay(300);
  }
  return false;
}

async function withServer(run) {
  if (process.env.EXHIBITION_BROWSER_URL || (await serverReady(500))) return run();
  const child = spawn(
    NPM,
    ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '5187', '--strictPort'],
    { cwd: WEB_DIR, stdio: 'ignore', shell: process.platform === 'win32' }
  );
  try {
    assert.ok(await serverReady(), 'exhibition dev server did not start');
    return await run();
  } finally {
    child.kill('SIGTERM');
  }
}

async function waitForScene(page, scene) {
  await page.waitForFunction(
    (expected) =>
      window.__EXHIBITION_TELEMETRY__?.scene === expected &&
      document.querySelector('.exhibition-page')?.getAttribute('data-page-state') === expected,
    scene,
    { timeout: 60_000 }
  );
  assert.equal(await page.locator('canvas').count(), 1);
}

async function enterLake(page) {
  await page.locator('canvas').click({ position: { x: 1195, y: 648 } });
  await page.getByRole('heading', { name: '西湖数字沙盘' }).waitFor();
  await page.getByRole('button', { name: '进入西湖沙盘' }).click();
  await waitForScene(page, 'lake');
}

async function sampleFps(page, warmupMs = 10_000, sampleSeconds = 15) {
  await page.waitForTimeout(warmupMs);
  const samples = [];
  for (let index = 0; index < sampleSeconds; index += 1) {
    await page.waitForTimeout(1_000);
    const fps = await page.evaluate(() => window.__EXHIBITION_TELEMETRY__?.rollingFps ?? 0);
    if (fps > 0) samples.push(fps);
  }
  assert.ok(samples.length >= 12, `expected at least 12 FPS samples, received ${samples.length}`);
  return samples.reduce((total, value) => total + value, 0) / samples.length;
}

describe.runIf(ENABLED)('exhibition browser performance', () => {
  it('meets scene FPS budgets and remains resource-stable across five round trips', async () => {
    await withServer(async () => {
      const browser = await chromium.launch({
        executablePath: process.platform === 'win32' ? EDGE : undefined,
        headless: true
      });
      try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        await page.addInitScript(() => {
          const tracked = new Set([
            'keydown',
            'keyup',
            'pointermove',
            'pointerup',
            'pointerdown',
            'pointerlockchange',
            'blur',
            'click'
          ]);
          const registrations = new Map();
          const nativeAdd = EventTarget.prototype.addEventListener;
          const nativeRemove = EventTarget.prototype.removeEventListener;
          EventTarget.prototype.addEventListener = function (type, listener, options) {
            if (listener && tracked.has(type)) {
              const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
              const byType = registrations.get(this) ?? new Map();
              const byListener = byType.get(type) ?? new Map();
              const captures = byListener.get(listener) ?? new Set();
              captures.add(capture);
              byListener.set(listener, captures);
              byType.set(type, byListener);
              registrations.set(this, byType);
            }
            return nativeAdd.call(this, type, listener, options);
          };
          EventTarget.prototype.removeEventListener = function (type, listener, options) {
            if (listener && tracked.has(type)) {
              const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
              registrations.get(this)?.get(type)?.get(listener)?.delete(capture);
            }
            return nativeRemove.call(this, type, listener, options);
          };
          window.__activeExhibitionListenerCount = () => {
            let count = 0;
            for (const byType of registrations.values())
              for (const byListener of byType.values())
                for (const captures of byListener.values()) count += captures.size;
            return count;
          };
        });
        await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
        await waitForScene(page, 'hall');

        const hallAverage = await sampleFps(page);
        assert.ok(hallAverage >= 45, `hall average ${hallAverage.toFixed(1)} FPS is below 45`);

        await enterLake(page);
        const lakeAverage = await sampleFps(page);
        assert.ok(lakeAverage >= 40, `lake average ${lakeAverage.toFixed(1)} FPS is below 40`);
        console.info(
          `Exhibition performance: hall ${hallAverage.toFixed(1)} FPS, lake ${lakeAverage.toFixed(1)} FPS`
        );

        const hallSnapshots = [];
        for (let visit = 0; visit < 5; visit += 1) {
          await page.getByRole('button', { name: '返回展馆' }).click();
          await waitForScene(page, 'hall');
          hallSnapshots.push(
            await page.evaluate(() => ({
              textures: window.__EXHIBITION_TELEMETRY__?.textures ?? 0,
              listeners: window.__activeExhibitionListenerCount?.() ?? 0,
              canvases: document.querySelectorAll('.exhibition-canvas-host canvas').length
            }))
          );
          await enterLake(page);
        }

        assert.ok(hallSnapshots.every((snapshot) => snapshot.canvases === 1));
        assert.equal(new Set(hallSnapshots.map((snapshot) => snapshot.listeners)).size, 1);
        const textureCounts = hallSnapshots.map((snapshot) => snapshot.textures);
        assert.ok(Math.max(...textureCounts) - Math.min(...textureCounts) <= 2);
        await page.close();
      } finally {
        await browser.close();
      }
    });
  }, 300_000);
});
