import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

describe('desktop split layout', () => {
  it('keeps the viewport fixed while the guide column scrolls independently', () => {
    expect(css).toMatch(/\.app-shell\s*{[^}]*height:\s*100vh;[^}]*overflow:\s*hidden;/s);
    expect(css).toMatch(
      /\.guide-panel\s*{[^}]*height:\s*100%;[^}]*min-height:\s*0;[^}]*overflow-y:\s*auto;/s
    );
    expect(css).toMatch(/\.guide-panel\s*>\s*\*\s*{[^}]*flex-shrink:\s*0;/s);
    expect(css).toMatch(/\.digital-human-panel\s*{[^}]*height:\s*100%;[^}]*min-height:\s*0;/s);
  });

  it('restores normal document scrolling on narrow screens', () => {
    expect(css).toMatch(
      /@media \(max-width: 860px\)[\s\S]*?\.app-shell\s*{[^}]*height:\s*auto;[^}]*min-height:\s*100vh;[^}]*overflow:\s*visible;/s
    );
    expect(css).toMatch(
      /@media \(max-width: 860px\)[\s\S]*?\.guide-panel\s*{[^}]*height:\s*auto;[^}]*overflow-y:\s*visible;/s
    );
  });
});
