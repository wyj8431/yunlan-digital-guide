import { describe, expect, it } from 'vitest';
import { PerformanceMonitor } from '../src/lab/lip-sync/performance/performanceMonitor';

describe('PerformanceMonitor', () => {
  it('aggregates average fps and p95 frame time from recent frames', () => {
    const monitor = new PerformanceMonitor({ qualityTier: 'high' });

    for (let index = 0; index <= 120; index += 1) {
      monitor.recordFrame(index * 16.7);
    }

    expect(monitor.snapshot().averageFps).toBeCloseTo(60, 0);
    expect(monitor.snapshot().p95FrameMs).toBeCloseTo(16.7, 1);
    expect(monitor.snapshot().qualityTier).toBe('high');
  });

  it('records mouth response latency and renderer counters', () => {
    const monitor = new PerformanceMonitor({ qualityTier: 'medium' });

    monitor.markAudioStart(100);
    monitor.markMouthResponse(248);
    monitor.setRendererInfo({
      render: { calls: 12, triangles: 3456 }
    });

    expect(monitor.snapshot()).toMatchObject({
      mouthResponseMs: 148,
      drawCalls: 12,
      triangles: 3456,
      heapMb: null
    });
  });

  it('keeps only a bounded frame window', () => {
    const monitor = new PerformanceMonitor();

    for (let index = 0; index <= 700; index += 1) {
      monitor.recordFrame(index * 20);
    }

    expect(monitor.snapshot().averageFps).toBeCloseTo(50, 0);
    expect(monitor.frameCount).toBeLessThanOrEqual(600);
  });
});
