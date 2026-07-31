// 嘴型实验室组合音频输入、渲染舞台、参数控制和性能监控。
import { useCallback, useEffect, useRef } from 'react';
import type { AudioAnalysisFrame, AudioAnalysisSession } from './audio/audioSource';
import { AudioSourceToolbar } from './components/AudioSourceToolbar';
import { LipSyncControls } from './components/LipSyncControls';
import { LipSyncStage } from './components/LipSyncStage';
import { PerformancePanel } from './components/PerformancePanel';
import { DEFAULT_PERFORMANCE_SNAPSHOT, useLipSyncLabStore } from './store/useLipSyncLabStore';
import type { LipSyncDebugFrame } from './three/LipSyncRenderer';
import './lipSyncLab.css';

const SILENT_FRAME: AudioAnalysisFrame = {
  rms: 0,
  currentTime: 0,
  duration: 0,
  playing: false
};

export function LipSyncLab() {
  const audioSessionRef = useRef<AudioAnalysisSession | null>(null);
  const debugStateRef = useRef<LipSyncDebugFrame>({
    currentMouthOpen: 0,
    audioStartTimestamp: null,
    mouthResponseTimestamp: null,
    metrics: useLipSyncLabStore.getState().metrics ?? DEFAULT_PERFORMANCE_SNAPSHOT
  });
  const getAudioFrame = useCallback(() => audioSessionRef.current?.sample() ?? SILENT_FRAME, []);
  const onDebugFrame = useCallback((frame: LipSyncDebugFrame) => {
    debugStateRef.current = frame;
  }, []);
  const disposeAudioSession = useCallback(() => {
    void audioSessionRef.current?.dispose();
    audioSessionRef.current = null;
  }, []);

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);

    if (search.get('phase3a-debug') !== '1') {
      return;
    }

    Object.defineProperty(window, '__LIP_SYNC_DEBUG__', {
      configurable: true,
      get: () => ({
        currentMouthOpen: debugStateRef.current.currentMouthOpen,
        audioStartTimestamp: debugStateRef.current.audioStartTimestamp,
        mouthResponseTimestamp: debugStateRef.current.mouthResponseTimestamp,
        metrics: debugStateRef.current.metrics
      })
    });

    return () => {
      delete window.__LIP_SYNC_DEBUG__;
    };
  }, []);

  useEffect(
    () => () => {
      disposeAudioSession();
    },
    [disposeAudioSession]
  );

  useEffect(() => {
    window.addEventListener('pagehide', disposeAudioSession);

    return () => {
      window.removeEventListener('pagehide', disposeAudioSession);
    };
  }, [disposeAudioSession]);

  return (
    <main className="lip-sync-lab">
      <AudioSourceToolbar audioSessionRef={audioSessionRef} />
      <LipSyncControls />
      <div className="lip-sync-lab__stage">
        <h1>口型与性能实验室</h1>
        <LipSyncStage getAudioFrame={getAudioFrame} onDebugFrame={onDebugFrame} />
      </div>
      <PerformancePanel />
    </main>
  );
}
