// 暴露仅用于自动化验收的嘴型实验室调试快照。
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
