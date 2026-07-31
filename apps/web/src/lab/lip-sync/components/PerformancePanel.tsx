// 性能面板展示帧率、帧耗时、画质等级和嘴型输入快照。
import { useLipSyncLabStore } from '../store/useLipSyncLabStore';

export function PerformancePanel() {
  const metrics = useLipSyncLabStore((state) => state.metrics);

  return (
    <section className="lip-sync-panel lip-sync-metrics" aria-label="性能面板">
      <h2>实时指标</h2>
      <dl role="status" aria-label="性能指标">
        <div>
          <dt>FPS</dt>
          <dd>{metrics.averageFps.toFixed(1)}</dd>
        </div>
        <div>
          <dt>P95 帧时</dt>
          <dd>{metrics.p95FrameMs.toFixed(1)}ms</dd>
        </div>
        <div>
          <dt>响应延迟</dt>
          <dd>
            {metrics.mouthResponseMs === null ? '-' : `${metrics.mouthResponseMs.toFixed(0)}ms`}
          </dd>
        </div>
        <div>
          <dt>Draw calls</dt>
          <dd>{metrics.drawCalls}</dd>
        </div>
        <div>
          <dt>Triangles</dt>
          <dd>{metrics.triangles}</dd>
        </div>
        <div>
          <dt>Heap</dt>
          <dd>{metrics.heapMb === null ? 'unsupported' : `${metrics.heapMb}MB`}</dd>
        </div>
        <div>
          <dt>Quality</dt>
          <dd>{metrics.qualityTier}</dd>
        </div>
      </dl>
    </section>
  );
}
