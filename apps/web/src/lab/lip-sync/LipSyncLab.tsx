import { useCallback, useEffect, useRef } from 'react';
import type { AudioAnalysisFrame, AudioAnalysisSession } from './audio/audioSource';
import { AudioSourceToolbar } from './components/AudioSourceToolbar';
import { LipSyncControls } from './components/LipSyncControls';
import { LipSyncStage } from './components/LipSyncStage';
import { PerformancePanel } from './components/PerformancePanel';
import './lipSyncLab.css';

const SILENT_FRAME: AudioAnalysisFrame = {
  rms: 0,
  currentTime: 0,
  duration: 0,
  playing: false
};

export function LipSyncLab() {
  const audioSessionRef = useRef<AudioAnalysisSession | null>(null);
  const getAudioFrame = useCallback(() => audioSessionRef.current?.sample() ?? SILENT_FRAME, []);

  useEffect(
    () => () => {
      void audioSessionRef.current?.dispose();
      audioSessionRef.current = null;
    },
    []
  );

  return (
    <main className="lip-sync-lab">
      <AudioSourceToolbar audioSessionRef={audioSessionRef} />
      <LipSyncControls />
      <div className="lip-sync-lab__stage">
        <h1>口型与性能实验室</h1>
        <LipSyncStage getAudioFrame={getAudioFrame} />
      </div>
      <PerformancePanel />
    </main>
  );
}
