import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { describe, it } from 'vitest';

const WEB_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL = process.env.EXHIBITION_BROWSER_URL ?? 'http://127.0.0.1:5187/exhibition';
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function ready(timeout = 60_000) {
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
  if (process.env.EXHIBITION_BROWSER_URL || (await ready(500))) return run();
  const child = spawn(
    NPM,
    ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '5187', '--strictPort'],
    {
      cwd: WEB_DIR,
      stdio: 'ignore',
      shell: process.platform === 'win32'
    }
  );
  try {
    assert.ok(await ready(), 'exhibition dev server did not start');
    return await run();
  } finally {
    child.kill('SIGTERM');
  }
}

function launchOptions() {
  return process.platform === 'win32'
    ? { executablePath: EDGE, headless: true }
    : { headless: true };
}

function pngVariance(buffer) {
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const chunks = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += length + 12;
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9];
    } else if (type === 'IDAT') chunks.push(data);
  }
  const channels = colorType === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(chunks));
  const stride = width * channels;
  let cursor = 0;
  let previous = Buffer.alloc(stride);
  const values = new Set();
  for (let y = 0; y < height; y += 1) {
    const filter = raw[cursor++];
    const row = Buffer.from(raw.subarray(cursor, cursor + stride));
    cursor += stride;
    for (let x = 0; x < stride; x += 1) {
      const left = x >= channels ? row[x - channels] : 0;
      const up = previous[x] ?? 0;
      const upLeft = x >= channels ? previous[x - channels] : 0;
      if (filter === 1) row[x] = (row[x] + left) & 255;
      if (filter === 2) row[x] = (row[x] + up) & 255;
      if (filter === 3) row[x] = (row[x] + Math.floor((left + up) / 2)) & 255;
      if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left),
          pb = Math.abs(p - up),
          pc = Math.abs(p - upLeft);
        row[x] = (row[x] + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft)) & 255;
      }
    }
    for (let x = 0; x < stride; x += channels * 32)
      values.add(`${row[x]},${row[x + 1]},${row[x + 2]}`);
    previous = row;
  }
  return values.size;
}

async function assertCanvasPainted(page) {
  const screenshot = await page.locator('canvas').screenshot();
  assert.ok(pngVariance(screenshot) > 8, 'canvas screenshot appears blank');
}

describe('exhibition browser acceptance', () => {
  it('renders a nonblank full-bleed Three scene without control overlap at desktop sizes', async () => {
    await withServer(async () => {
      const browser = await chromium.launch(launchOptions());
      try {
        for (const viewport of [
          { width: 1440, height: 900 },
          { width: 1920, height: 1080 }
        ]) {
          const page = await browser.newPage({ viewport });
          const consoleErrors = [];
          page.on('console', (message) => {
            if (message.type() === 'error') consoleErrors.push(message.text());
          });
          await page.goto(URL, { waitUntil: 'networkidle' });
          await page.locator('canvas').waitFor({ state: 'visible' });
          await page.waitForTimeout(500);
          assert.equal(await page.locator('canvas').count(), 1);
          await assertCanvasPainted(page);

          const canvasBox = await page.locator('canvas').boundingBox();
          assert.ok(canvasBox, 'canvas has no layout box');
          assert.equal(Math.round(canvasBox.width), viewport.width);
          assert.equal(Math.round(canvasBox.height), viewport.height);

          const boxes = await page.locator('.exhibition-topbar button').evaluateAll((buttons) =>
            buttons.map((button) => {
              const box = button.getBoundingClientRect();
              return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
            })
          );
          assert.equal(boxes.length, 2);
          assert.ok(boxes[0].right <= boxes[1].left, 'top controls overlap');
          const hint = await page.locator('.exhibition-hint').boundingBox();
          const topbar = await page.locator('.exhibition-topbar').boundingBox();
          assert.ok(
            hint && topbar && topbar.y + topbar.height < hint.y,
            'topbar overlaps movement hint'
          );
          assert.equal(await page.locator('.exhibition-render-error').count(), 0);
          assert.deepEqual(consoleErrors, []);
          await page.close();
        }
      } finally {
        await browser.close();
      }
    });
  }, 90_000);
});
