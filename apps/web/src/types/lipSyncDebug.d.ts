import type { PerformanceSnapshot } from '../lab/lip-sync/types';

declare global {
  interface Window {
    __LIP_SYNC_DEBUG__?: {
      currentMouthOpen: number;
      audioStartTimestamp: number | null;
      mouthResponseTimestamp: number | null;
      metrics: PerformanceSnapshot;
    };
  }
}

export {};
