import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_LIP_SYNC_LAB_STATE,
  useLipSyncLabStore
} from '../src/lab/lip-sync/store/useLipSyncLabStore';

describe('useLipSyncLabStore', () => {
  beforeEach(() => {
    useLipSyncLabStore.getState().reset();
  });

  it('clamps parameter updates to usable ranges', () => {
    useLipSyncLabStore.getState().updateConfig({
      threshold: -1,
      sensitivity: 12,
      maxOpen: 2,
      attackMs: -20,
      releaseMs: 5_000
    });

    expect(useLipSyncLabStore.getState().config).toMatchObject({
      threshold: 0,
      sensitivity: 5,
      maxOpen: 1,
      attackMs: 0,
      releaseMs: 1_000
    });
  });

  it('replaces metrics atomically', () => {
    const metrics = {
      averageFps: 58,
      p95FrameMs: 18,
      mouthResponseMs: 120,
      drawCalls: 14,
      triangles: 4096,
      heapMb: 72.4,
      qualityTier: 'high' as const
    };

    useLipSyncLabStore.getState().setMetrics(metrics);

    expect(useLipSyncLabStore.getState().metrics).toBe(metrics);
  });

  it('does not retain a stale local file when source mode changes', () => {
    const file = { name: 'voice.wav' } as File;

    useLipSyncLabStore.getState().setSourceFile(file);
    useLipSyncLabStore.getState().setSourceMode('url');

    expect(useLipSyncLabStore.getState().sourceMode).toBe('url');
    expect(useLipSyncLabStore.getState().sourceFile).toBeNull();
  });

  it('resets defaults after source, playback, and quality changes', () => {
    useLipSyncLabStore.getState().setSourceUrl('https://audio.test/a.wav');
    useLipSyncLabStore.getState().setPlayback('error', 'failed');
    useLipSyncLabStore.getState().setQualityTier('low');
    useLipSyncLabStore.getState().setAutomaticQuality(false);

    useLipSyncLabStore.getState().reset();

    expect(useLipSyncLabStore.getState()).toMatchObject(DEFAULT_LIP_SYNC_LAB_STATE);
  });
});
