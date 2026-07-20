import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSpeechSynthesis } from '../src/hooks/useSpeechSynthesis';

describe('useSpeechSynthesis', () => {
  beforeEach(() => {
    class TestUtterance {
      lang = '';
      rate = 1;
      pitch = 1;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;

      constructor(public readonly text: string) {}
    }

    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      configurable: true,
      value: TestUtterance
    });
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        cancel: vi.fn(),
        speak: vi.fn((utterance: TestUtterance) => {
          utterance.onstart?.();
          utterance.onend?.();
        })
      }
    });
  });

  it('speaks text with browser speech synthesis', () => {
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => {
      result.current.speak('欢迎来到云岚古镇');
    });

    expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(1);
  });
});
