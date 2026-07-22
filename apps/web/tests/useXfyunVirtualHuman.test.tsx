import { render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useXfyunVirtualHuman } from '../src/hooks/useXfyunVirtualHuman';
import { GUIDE_SPEECH_PLAYBACK_EVENT } from '../src/lib/guideSpeechSync';

const start = vi.fn().mockResolvedValue(undefined);
const speak = vi.fn().mockResolvedValue(undefined);
const stop = vi.fn().mockResolvedValue(undefined);

vi.mock('../src/api/virtualHumanApi', () => ({
  fetchVirtualHumanConfig: vi.fn().mockResolvedValue({
    enabled: true,
    provider: 'xfyun-vms',
    serviceId: 'service-id',
    sdkScriptUrl: '/libs/avatar-sdk/index.js',
    signedUrl: 'wss://avatar.cn-huadong-1.xf-yun.com/v1/interact?authorization=test',
    actions: [{ id: 'A_RH_bye_O', label: '再见' }],
    startConfig: {
      appId: 'app-id',
      apiKey: 'api-key',
      apiSecret: 'api-secret',
      avatarId: 'avatar-id',
      width: 720,
      height: 1280,
      isSsl: true,
      transparent: true,
      moveH: 0,
      moveV: 0,
      scale: 1
    },
    tts: {
      vcn: 'voice-id',
      speed: 50,
      pitch: 50,
      volume: 50,
      rhy: 3
    }
  })
}));

vi.mock('../src/lib/xfyunVirtualHumanClient', () => ({
  createXfyunVirtualHumanClient: vi.fn(() => ({
    start,
    speak,
    triggerAction: vi.fn().mockResolvedValue(undefined),
    stop
  }))
}));

function Harness({ answerText }: { answerText: string }) {
  useXfyunVirtualHuman({
    answerText,
    streamDomId: 'xfyun-avatar'
  });

  return <div id="xfyun-avatar" />;
}

afterEach(() => {
  start.mockClear();
  speak.mockClear();
  stop.mockClear();
});

describe('useXfyunVirtualHuman', () => {
  it('does not replay the current answer when the client becomes ready', async () => {
    const playbackEvents: Array<{ text: string; phase: string }> = [];
    window.addEventListener(GUIDE_SPEECH_PLAYBACK_EVENT, (event) => {
      playbackEvents.push((event as CustomEvent<{ text: string; phase: string }>).detail);
    });
    const { rerender } = render(<Harness answerText="先前答案" />);

    await waitFor(() => {
      expect(start).toHaveBeenCalledOnce();
    });

    await waitFor(() => {
      expect(speak).not.toHaveBeenCalled();
    });

    rerender(<Harness answerText="新的答案" />);

    await waitFor(() => {
      expect(speak).toHaveBeenCalledWith('新的答案');
    });
    expect(playbackEvents).toEqual([
      { text: '新的答案', phase: 'preparing' },
      { text: '新的答案', phase: 'start' },
      { text: '新的答案', phase: 'end' }
    ]);
  });
});
