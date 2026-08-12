// 嘴型实验室组合音频输入、渲染舞台、参数控制和性能监控。
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AudioAnalysisFrame, AudioAnalysisSession } from './audio/audioSource';
import { AudioSourceToolbar } from './components/AudioSourceToolbar';
import { LipSyncControls } from './components/LipSyncControls';
import { LipSyncStage } from './components/LipSyncStage';
import { PerformancePanel } from './components/PerformancePanel';
import { XfyunLabStage } from './components/XfyunLabStage';
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
  const [avatarMode, setAvatarMode] = useState<'local' | 'xfyun'>('local');
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
      {avatarMode === 'local' ? (
        <AudioSourceToolbar audioSessionRef={audioSessionRef} />
      ) : (
        <section className="lip-sync-panel lip-sync-online-panel" aria-label="讯飞在线模式说明">
          <h2>讯飞在线模式</h2>
          <p>讯飞 VMS 负责形象渲染、语音播放和口型。该模式不会同时播放本地音频。</p>
          <button type="button" onClick={() => setAvatarMode('local')}>
            切回本地口型实验
          </button>
        </section>
      )}
      {avatarMode === 'local' ? (
        <LipSyncControls />
      ) : (
        <section
          className="lip-sync-panel lip-sync-online-panel lip-sync-online-panel--metrics"
          aria-label="讯飞在线模式状态"
        >
          <h2>实验边界</h2>
          <p>在线模型由讯飞 SDK 渲染，下面的本地 WebGL FPS、Draw calls 和内存指标不适用。</p>
          <p>切回本地模式可继续使用预置音频、文件、URL 和性能基准。</p>
        </section>
      )}
      <div className="lip-sync-lab__stage">
        <h1>{avatarMode === 'local' ? '口型与性能实验室' : '讯飞在线数字人实验室'}</h1>
        <div className="lip-sync-avatar-mode" role="group" aria-label="数字人模型模式">
          <button
            type="button"
            aria-pressed={avatarMode === 'local'}
            onClick={() => setAvatarMode('local')}
          >
            本地 Three.js
          </button>
          <button
            type="button"
            aria-pressed={avatarMode === 'xfyun'}
            onClick={() => setAvatarMode('xfyun')}
          >
            讯飞在线模型
          </button>
        </div>
        {avatarMode === 'local' ? (
          <LipSyncStage getAudioFrame={getAudioFrame} onDebugFrame={onDebugFrame} />
        ) : (
          <XfyunLabStage onUseLocalFallback={() => setAvatarMode('local')} />
        )}
      </div>
      {avatarMode === 'local' ? (
        <PerformancePanel />
      ) : (
        <section className="lip-sync-panel lip-sync-metrics" aria-label="在线模型说明">
          <h2>在线模型</h2>
          <p>
            讯飞 VMS 已独占音频和口型同步。本地性能采样已暂停，避免把供应商视频流误记为 Three.js
            指标。
          </p>
        </section>
      )}
    </main>
  );
}
