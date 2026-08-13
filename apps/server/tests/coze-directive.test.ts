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

  it('strips an unclosed trailing directive left by a truncated stream', () => {
    const parsed = parseGuideDirective(
      '推荐西栅景区。<guide-directive>{"emotion":"warm","action":"A_RLH_welcome_O"'
    );

    expect(parsed).toEqual({
      answer: '推荐西栅景区。',
      avatarDirective: undefined
    });
  });

  it('keeps body text untouched when a closed directive is not at the end', () => {
    const parsed = parseGuideDirective(
      '介绍 <guide-directive>{"action":"A_RH_hello_O"}</guide-directive> 这个词。'
    );

    expect(parsed.answer).toBe(
      '介绍 <guide-directive>{"action":"A_RH_hello_O"}</guide-directive> 这个词。'
    );
  });

  it('strips a case-variant unclosed trailing directive', () => {
    const parsed = parseGuideDirective('好的。<Guide-Directive>{"action":"A_RH_hello_O"}');

    expect(parsed).toEqual({ answer: '好的。', avatarDirective: undefined });
  });
});
