import { describe, expect, it } from 'vitest';
import {
  createGuideDirectiveStreamSanitizer,
  parseGuideDirective
} from '../src/modules/guide/coze-directive';

describe('Coze avatar directive protocol', () => {
  it('parses and removes a valid trailing directive', () => {
    const parsed = parseGuideDirective(
      '欢迎来到乌镇。<guide-directive>{"emotion":"warm","action":"A_RLH_welcome_O","scene":"welcome"}</guide-directive>'
    );

    expect(parsed).toEqual({
      answer: '欢迎来到乌镇。',
      avatarDirective: { emotion: 'warm', action: 'A_RLH_welcome_O', scene: 'welcome' }
    });
  });

  it('does not authorize unknown or malformed directives', () => {
    expect(
      parseGuideDirective('回答。<guide-directive>{"action":"delete-all"}</guide-directive>')
    ).toEqual({
      answer: '回答。',
      avatarDirective: undefined
    });
    expect(parseGuideDirective('回答。<guide-directive>not-json</guide-directive>')).toEqual({
      answer: '回答。',
      avatarDirective: undefined
    });
  });

  it('keeps directive markup out of streamed deltas', () => {
    const deltas: string[] = [];
    const sanitizer = createGuideDirectiveStreamSanitizer((delta) => deltas.push(delta));
    sanitizer.push('回答。<guide-');
    sanitizer.push('directive>{"action":"A_RH_hello_O"}</guide-directive>');
    sanitizer.flush();

    expect(deltas.join('')).toBe('回答。');
    expect(deltas.join('')).not.toContain('guide-directive');
  });
});
