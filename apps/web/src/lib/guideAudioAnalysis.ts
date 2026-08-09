import { calculateRms } from '../lab/lip-sync/audio/mouthSignal';

// Work order: website Three.js digital-human lip sync and audio synchronization.

export type GuideAudioAnalysisSnapshot = {
  playbackId: string | null;
  playing: boolean;
  rms: number;
};

type ActiveGuideAudioAnalysis = {
  playbackId: string;
  analyser: AnalyserNode;
  samples: Float32Array<ArrayBuffer>;
};

let activeAnalysis: ActiveGuideAudioAnalysis | null = null;

export function connectGuideAudioAnalysis(
  context: AudioContext,
  source: AudioBufferSourceNode,
  playbackId: string
) {
  disconnectGuideAudioAnalysis();

  const createAnalyser = (context as Partial<AudioContext>).createAnalyser;
  if (!createAnalyser) {
    source.connect(context.destination);
    return;
  }

  const analyser = createAnalyser.call(context);
  analyser.fftSize = 2048;
  source.connect(analyser);
  analyser.connect(context.destination);
  const samples = new Float32Array(analyser.fftSize) as Float32Array<ArrayBuffer>;
  activeAnalysis = {
    playbackId,
    analyser,
    samples
  };
}

export function sampleGuideAudioAnalysis(): GuideAudioAnalysisSnapshot {
  if (!activeAnalysis) {
    return { playbackId: null, playing: false, rms: 0 };
  }

  activeAnalysis.analyser.getFloatTimeDomainData(activeAnalysis.samples);
  return {
    playbackId: activeAnalysis.playbackId,
    playing: true,
    rms: calculateRms(activeAnalysis.samples)
  };
}

export function disconnectGuideAudioAnalysis(playbackId?: string) {
  if (!activeAnalysis || (playbackId && activeAnalysis.playbackId !== playbackId)) {
    return;
  }

  activeAnalysis.analyser.disconnect();
  activeAnalysis = null;
}

export function resetGuideAudioAnalysis() {
  disconnectGuideAudioAnalysis();
}
