// 音频工具栏统一管理麦克风、文件、演示信号和播放状态。
import type { MutableRefObject } from 'react';
import { ArrowLeft, Link, Mic, Pause, Play, RotateCcw, Upload } from 'lucide-react';
import { createAudioAnalysisSession, type AudioAnalysisSession } from '../audio/audioSource';
import type { LabAudioSource } from '../types';
import { useLipSyncLabStore } from '../store/useLipSyncLabStore';

type AudioSourceToolbarProps = {
  audioSessionRef: MutableRefObject<AudioAnalysisSession | null>;
};

function createSourceFromState(): LabAudioSource {
  const state = useLipSyncLabStore.getState();

  if (state.sourceMode === 'file') {
    if (!state.sourceFile) {
      throw new Error('请选择本地音频文件');
    }

    return { kind: 'file', file: state.sourceFile };
  }

  if (state.sourceMode === 'url') {
    const url = new URL(state.sourceUrl);

    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('请输入 http 或 https 音频地址');
    }

    return { kind: 'url', url: url.href };
  }

  if (state.sourceMode === 'microphone') {
    return { kind: 'microphone' };
  }

  return { kind: 'preset' };
}

export function AudioSourceToolbar({ audioSessionRef }: AudioSourceToolbarProps) {
  const sourceMode = useLipSyncLabStore((state) => state.sourceMode);
  const sourceUrl = useLipSyncLabStore((state) => state.sourceUrl);
  const playback = useLipSyncLabStore((state) => state.playback);
  const error = useLipSyncLabStore((state) => state.error);
  const setSourceMode = useLipSyncLabStore((state) => state.setSourceMode);
  const setSourceUrl = useLipSyncLabStore((state) => state.setSourceUrl);
  const setSourceFile = useLipSyncLabStore((state) => state.setSourceFile);
  const setPlayback = useLipSyncLabStore((state) => state.setPlayback);
  const resetStore = useLipSyncLabStore((state) => state.reset);

  const disposeSession = () => {
    void audioSessionRef.current?.dispose();
    audioSessionRef.current = null;
  };

  const selectSourceMode = (mode: typeof sourceMode) => {
    disposeSession();
    setSourceMode(mode);
    setPlayback('idle');
  };

  const play = async () => {
    try {
      setPlayback('loading');

      if (!audioSessionRef.current) {
        audioSessionRef.current = await createAudioAnalysisSession(createSourceFromState());
      }

      await audioSessionRef.current.play();
      setPlayback('playing');
    } catch (caught) {
      disposeSession();
      setPlayback('error', caught instanceof Error ? caught.message : '音频加载失败');
    }
  };

  const pause = () => {
    audioSessionRef.current?.pause();
    setPlayback('paused');
  };

  const reset = () => {
    disposeSession();
    resetStore();
  };

  return (
    <section className="lip-sync-panel lip-sync-toolbar" aria-label="音频源与播放控制">
      <div className="lip-sync-toolbar__top">
        <button
          type="button"
          className="lip-sync-icon-button"
          aria-label="返回导游"
          title="返回导游"
          onClick={() => window.history.pushState({}, '', '/')}
        >
          <ArrowLeft aria-hidden="true" size={18} />
        </button>
        <div className="lip-sync-toolbar__transport">
          <button type="button" aria-label="播放" title="播放" onClick={() => void play()}>
            <Play aria-hidden="true" size={18} />
          </button>
          <button type="button" aria-label="暂停" title="暂停" onClick={pause}>
            <Pause aria-hidden="true" size={18} />
          </button>
          <button type="button" aria-label="重置" title="重置" onClick={reset}>
            <RotateCcw aria-hidden="true" size={18} />
          </button>
        </div>
      </div>

      <div className="lip-sync-segmented" aria-label="音频源">
        <button
          type="button"
          aria-pressed={sourceMode === 'preset'}
          onClick={() => selectSourceMode('preset')}
        >
          预置音频
        </button>
        <button
          type="button"
          aria-pressed={sourceMode === 'file'}
          onClick={() => selectSourceMode('file')}
        >
          本地文件
        </button>
        <button
          type="button"
          aria-pressed={sourceMode === 'url'}
          onClick={() => selectSourceMode('url')}
        >
          音频 URL
        </button>
        <button
          type="button"
          aria-pressed={sourceMode === 'microphone'}
          onClick={() => selectSourceMode('microphone')}
        >
          <Mic aria-hidden="true" size={16} /> 实时麦克风
        </button>
      </div>

      <label className="lip-sync-file-control">
        <Upload aria-hidden="true" size={16} />
        <span>选择音频</span>
        <input
          type="file"
          accept="audio/*"
          onChange={(event) => {
            disposeSession();
            setSourceFile(event.currentTarget.files?.[0] ?? null);
            setPlayback('idle');
          }}
        />
      </label>

      <label className="lip-sync-url-control">
        <Link aria-hidden="true" size={16} />
        <span>音频地址</span>
        <input
          value={sourceUrl}
          placeholder="https://"
          onChange={(event) => {
            disposeSession();
            setSourceUrl(event.currentTarget.value);
            setPlayback('idle');
          }}
        />
      </label>

      <p role="status" aria-label="播放状态" className="lip-sync-status">
        {error ?? `当前状态：${playback}`}
      </p>
    </section>
  );
}
