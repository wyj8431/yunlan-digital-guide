import { afterEach, describe, expect, it, vi } from 'vitest';
import { readEnv } from '../src/config/env';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('server env', () => {
  it('does not reuse the virtual human voice as the default tts voice', () => {
    vi.stubEnv('XFYUN_TTS_VOICE', '');
    vi.stubEnv('XFYUN_VIRTUAL_HUMAN_TTS_VOICE', 'x4_lingxiaoxuan_oral');

    expect(readEnv().xfyunTtsVoice).toBe('xiaoyan');
  });
});
