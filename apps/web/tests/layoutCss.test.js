import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
const videoCenterStart = css.indexOf('.video-center-page');
const dedicatedTourismStart = css.indexOf('.tourism-page {', videoCenterStart);
const dedicatedTourismCss = css.slice(dedicatedTourismStart);

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

  it('defines responsive full-page tourism routes', () => {
    expect(videoCenterStart).toBeGreaterThanOrEqual(0);
    expect(dedicatedTourismStart).toBeGreaterThan(videoCenterStart);
    expect(css).toMatch(/\.tourism-page\s*{/);
    expect(css).toMatch(/\.tourism-page-content\s*{/);
    expect(css).toMatch(/\.tourism-page-back\s*{/);
    expect(css).toMatch(
      /@media \(max-width: 760px\)[\s\S]*?\.tourism-page-content\s*{[^}]*max-width:\s*100%;/s
    );
    expect(css).toMatch(/\.tourism-home-observatory\s*{/);
    expect(css).toMatch(/\.tourism-guide-constellation\s*{/);
    expect(css).toMatch(/\.tourism-story-stage\s*{/);
    expect(css).toMatch(/\.tourism-canal-map\s*{/);
    expect(css).toMatch(/\.tourism-itinerary-stream\s*{/);
    expect(css).toMatch(/\.tourism-voice-field\s*{/);
    expect(css).toMatch(/\.tourism-passport\s*{/);
    expect(dedicatedTourismCss).toContain("url('/images/wuzhen-real/waterway.jpg')");
    expect(dedicatedTourismCss).not.toContain("url('/images/solarpunk-reference.png')");
    expect(dedicatedTourismCss).not.toContain("url('/images/tourism-bg.png')");
    expect(dedicatedTourismCss).toMatch(
      /\.tourism-canal-map\s*{[^}]*background:[^;]+;[^}]*background-color:\s*#063d35;/s
    );
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
  });

  it('keeps the history page and both history columns independently scrollable', () => {
    expect(css).toMatch(
      /\.history-page\s*{[^}]*height:\s*100vh;[^}]*height:\s*100dvh;[^}]*overflow-y:\s*auto;/s
    );
    expect(css).toMatch(/\.history-workspace\s*{[^}]*grid-template-rows:\s*minmax\(0,\s*1fr\);/s);
    expect(css).toMatch(/\.history-session-panel\s*{[^}]*min-height:\s*0;/s);
    expect(css).toMatch(/\.history-session-list\s*{[^}]*overflow-y:\s*auto;/s);
    expect(css).toMatch(/\.history-transcript \.chat-messages\s*{[^}]*overflow-y:\s*auto;/s);
    expect(css).toMatch(
      /\.history-session-list::-webkit-scrollbar,[\s\S]*?\.history-transcript \.chat-messages::-webkit-scrollbar\s*{[^}]*display:\s*block;/s
    );
  });

  it('opens the answer export menu above its trigger inside the scrollable chat', () => {
    expect(css).toMatch(/\.message-export-menu\s*{[^}]*top:\s*auto;[^}]*bottom:\s*34px;/s);
  });

  it('keeps exhibition transitions and dialogs in responsive safe areas', () => {
    expect(css).toMatch(
      /\.exhibition-transition\s*{[^}]*position:\s*absolute;[^}]*inset:\s*0;[^}]*pointer-events:\s*none;/s
    );
    expect(css).toMatch(
      /@media \(max-width: 640px\)[\s\S]*?\.exhibit-dialog\s*{[^}]*max-height:\s*calc\(100dvh - 238px\);[^}]*overflow-y:\s*auto;/s
    );
  });
});
