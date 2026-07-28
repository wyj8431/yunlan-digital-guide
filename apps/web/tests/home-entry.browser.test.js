import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { describe, it } from 'vitest';

const WEB_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE_URL = process.env.HOME_ENTRY_BROWSER_URL ?? 'http://127.0.0.1:5189';
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function ready(timeout = 60_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      if ((await fetch(BASE_URL)).ok) return true;
    } catch {
      // Vite may still be starting.
    }
    await delay(300);
  }
  return false;
}

async function withServer(run) {
  if (process.env.HOME_ENTRY_BROWSER_URL || (await ready(500))) return run();

  const child = spawn(
    NPM,
    ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '5189', '--strictPort'],
    {
      cwd: WEB_DIR,
      stdio: 'ignore',
      shell: process.platform === 'win32'
    }
  );

  try {
    assert.ok(await ready(), `web dev server did not start at ${BASE_URL}`);
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

function overlaps(first, second) {
  return !(
    first.right <= second.left ||
    first.left >= second.right ||
    first.bottom <= second.top ||
    first.top >= second.bottom
  );
}

describe('home destination entry browser acceptance', () => {
  it('keeps subtle top-right links clear of the main UI and navigates to both pages', async () => {
    await withServer(async () => {
      const browser = await chromium.launch(launchOptions());
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

      try {
        await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });

        const links = page.locator('.home-destination-link');
        await links.first().waitFor({ state: 'visible' });
        assert.equal(await links.count(), 2);
        assert.equal(
          await links.first().evaluate((element) => getComputedStyle(element).opacity),
          '0.14'
        );

        await links.first().hover();
        await page.waitForTimeout(220);
        const hoverStyle = await links.first().evaluate((element) => {
          const style = getComputedStyle(element);
          return { opacity: style.opacity, backgroundColor: style.backgroundColor };
        });
        assert.equal(hoverStyle.opacity, '1');
        assert.equal(hoverStyle.backgroundColor, 'rgb(186, 248, 220)');

        const linkBoxes = await links.evaluateAll((elements) =>
          elements.map((element) => {
            const box = element.getBoundingClientRect();
            return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
          })
        );
        const uiBoxes = await page
          .locator('.app-title h1, .app-title p, .guide-panel, .digital-human-panel, .scenic-panel')
          .evaluateAll((elements) =>
            elements
              .filter((element) => getComputedStyle(element).visibility !== 'hidden')
              .map((element) => {
                const box = element.getBoundingClientRect();
                return {
                  label: element.className,
                  left: box.left,
                  right: box.right,
                  top: box.top,
                  bottom: box.bottom
                };
              })
          );
        for (const [linkIndex, linkBox] of linkBoxes.entries()) {
          for (const uiBox of uiBoxes) {
            assert.equal(
              overlaps(linkBox, uiBox),
              false,
              `destination link ${linkIndex} overlaps ${uiBox.label}: ${JSON.stringify({ linkBox, uiBox })}`
            );
          }
        }

        await page.getByRole('link', { name: '3D 展馆' }).click();
        await page.waitForURL('**/exhibition');
        assert.equal(new URL(page.url()).pathname, '/exhibition');

        await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
        await page.getByRole('link', { name: '视频中心' }).click();
        await page.waitForURL('**/videos');
        assert.equal(new URL(page.url()).pathname, '/videos');
      } finally {
        await page.close();
        await browser.close();
      }
    });
  }, 90_000);
});
