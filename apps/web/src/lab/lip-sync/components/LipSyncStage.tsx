import { useEffect, useRef, useState } from 'react';
import type { AudioAnalysisFrame } from '../audio/audioSource';
import { LipSyncRenderer } from '../three/LipSyncRenderer';
import { DEFAULT_PERFORMANCE_SNAPSHOT, useLipSyncLabStore } from '../store/useLipSyncLabStore';

const DEFAULT_MODEL_URL = '/models/Thanh.glb';

const SILENT_AUDIO_FRAME: AudioAnalysisFrame = {
  rms: 0,
  currentTime: 0,
  duration: 0,
  playing: false
};

type LipSyncStageProps = {
  modelUrl?: string;
  getAudioFrame?: () => AudioAnalysisFrame;
};

export function LipSyncStage({
  modelUrl = DEFAULT_MODEL_URL,
  getAudioFrame = () => SILENT_AUDIO_FRAME
}: LipSyncStageProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<LipSyncRenderer | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    const host = hostRef.current;

    if (!host) {
      return;
    }

    const renderer = new LipSyncRenderer({
      host,
      modelUrl,
      getAudioFrame,
      getConfig: () => useLipSyncLabStore.getState().config,
      getQualityTier: () => useLipSyncLabStore.getState().qualityTier,
      onMetrics: (metrics) => useLipSyncLabStore.getState().setMetrics(metrics),
      onReady: () => setStatus('ready'),
      onError: () => {
        useLipSyncLabStore.getState().setMetrics(DEFAULT_PERFORMANCE_SNAPSHOT);
        setStatus('error');
      }
    });
    rendererRef.current = renderer;
    void renderer.start();

    const resizeObserver = new ResizeObserver(() => renderer.resize());
    resizeObserver.observe(host);

    return () => {
      resizeObserver.disconnect();
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [getAudioFrame, modelUrl]);

  return (
    <section className="lip-sync-stage" aria-label="本地 3D 数字人口型预览">
      <div ref={hostRef} className="lip-sync-stage__host" />
      <p className="lip-sync-stage__status" role="status">
        {status === 'ready'
          ? '3D 模型已加载'
          : status === 'error'
            ? '3D 模型加载失败'
            : '正在加载 3D 模型'}
      </p>
    </section>
  );
}
