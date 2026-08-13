import { calculateRms } from './mouthSignal';
import type { LabAudioSource } from '../types';

// WO-6: audio-source lifecycle, microphone capture, and analyser cleanup.

/** A single analyser sample used by the renderer and performance monitor. */
export type AudioAnalysisFrame = {
  rms: number;
  currentTime: number;
  duration: number;
  playing: boolean;
};

/**
 * Lifecycle contract for a local audio source. Call `dispose` when changing source
 * or unmounting the lab so capture tracks, nodes, and owned contexts are released.
 */
export type AudioAnalysisSession = {
  play(): Promise<void>;
  pause(): void;
  stop(): void;
  sample(): AudioAnalysisFrame;
  dispose(): Promise<void>;
};

type AudioSourceOptions = {
  context?: AudioContext;
  fetcher?: typeof fetch;
  mediaDevices?: Pick<MediaDevices, 'getUserMedia'>;
};

type BrowserWindowWithAudio = Window & {
  webkitAudioContext?: typeof AudioContext;
};

const PRESET_DURATION_SECONDS = 6;
const PRESET_TONE_HZ = 180;
const PRESET_WINDOWS = [
  [0.45, 1.2],
  [1.85, 2.7],
  [3.2, 4.05],
  [4.75, 5.55]
] as const;

/** Reads a file or URL source into bytes before Web Audio decoding. */
export async function readAudioSource(
  source: Exclude<LabAudioSource, { kind: 'preset' } | { kind: 'microphone' }>,
  fetcher: typeof fetch = fetch
): Promise<ArrayBuffer> {
  if (source.kind === 'file') {
    if (typeof source.file.arrayBuffer === 'function') {
      return source.file.arrayBuffer();
    }

    return new Response(source.file).arrayBuffer();
  }

  const response = await fetcher(source.url);

  if (!response.ok) {
    throw new Error(`Audio URL failed to load: ${response.status}`);
  }

  return response.arrayBuffer();
}

function createOwnedAudioContext() {
  const AudioContextConstructor =
    window.AudioContext ?? (window as BrowserWindowWithAudio).webkitAudioContext;

  if (!AudioContextConstructor) {
    throw new Error('Web Audio API is unavailable.');
  }

  return new AudioContextConstructor();
}

function amplitudeAt(time: number) {
  const activeWindow = PRESET_WINDOWS.find(([start, end]) => time >= start && time <= end);

  if (!activeWindow) {
    return 0;
  }

  const [start, end] = activeWindow;
  const fadeSeconds = 0.08;
  const fadeIn = Math.min(1, (time - start) / fadeSeconds);
  const fadeOut = Math.min(1, (end - time) / fadeSeconds);
  return Math.max(0, Math.min(fadeIn, fadeOut)) * 0.65;
}

function createPresetAudioBuffer(context: AudioContext) {
  const length = Math.round(context.sampleRate * PRESET_DURATION_SECONDS);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const samples = buffer.getChannelData(0);

  for (let index = 0; index < samples.length; index += 1) {
    const time = index / context.sampleRate;
    samples[index] = Math.sin(time * PRESET_TONE_HZ * Math.PI * 2) * amplitudeAt(time);
  }

  return buffer;
}

async function decodeAudioSource(
  source: Exclude<LabAudioSource, { kind: 'microphone' }>,
  context: AudioContext,
  fetcher: typeof fetch
) {
  if (source.kind === 'preset') {
    return createPresetAudioBuffer(context);
  }

  const bytes = await readAudioSource(source, fetcher);
  return context.decodeAudioData(bytes.slice(0));
}

async function createMicrophoneAnalysisSession(
  context: AudioContext,
  ownsContext: boolean,
  mediaDevices: Pick<MediaDevices, 'getUserMedia'>
): Promise<AudioAnalysisSession> {
  const stream = await mediaDevices.getUserMedia({ audio: true });
  const analyser = context.createAnalyser();
  analyser.fftSize = 2048;
  const sourceNode = context.createMediaStreamSource(stream);
  sourceNode.connect(analyser);
  const samples = new Float32Array(analyser.fftSize);
  let active = false;
  let disposed = false;
  let startedAt = 0;

  return {
    async play() {
      if (disposed) return;
      if (context.state === 'suspended') await context.resume();
      if (!active) startedAt = context.currentTime;
      active = true;
    },
    pause() {
      active = false;
    },
    stop() {
      active = false;
    },
    sample() {
      if (active) analyser.getFloatTimeDomainData(samples);
      else samples.fill(0);
      return {
        rms: calculateRms(samples),
        currentTime: active ? context.currentTime - startedAt : 0,
        duration: 0,
        playing: active
      };
    },
    async dispose() {
      disposed = true;
      active = false;
      stream.getTracks().forEach((track) => track.stop());
      sourceNode.disconnect();
      analyser.disconnect();
      if (ownsContext) await context.close();
    }
  };
}

/**
 * Creates a sampled Web Audio session for preset, file, URL, or microphone input.
 * Microphone sessions analyse input only and never route capture audio to speakers.
 */
export async function createAudioAnalysisSession(
  source: LabAudioSource,
  options: AudioSourceOptions = {}
): Promise<AudioAnalysisSession> {
  const context = options.context ?? createOwnedAudioContext();
  const ownsContext = !options.context;
  if (source.kind === 'microphone') {
    if (!options.mediaDevices && !navigator.mediaDevices) {
      if (ownsContext) await context.close();
      throw new Error('Microphone access is unavailable.');
    }
    return createMicrophoneAnalysisSession(
      context,
      ownsContext,
      options.mediaDevices ?? navigator.mediaDevices
    );
  }
  const buffer = await decodeAudioSource(source, context, options.fetcher ?? fetch);
  const analyser = context.createAnalyser();
  analyser.fftSize = 2048;
  analyser.connect(context.destination);

  let sourceNode: AudioBufferSourceNode | null = null;
  let playing = false;
  let disposed = false;
  let pauseOffset = 0;
  let startedAt = 0;
  const samples = new Float32Array(analyser.fftSize);

  const disconnectSource = (node: AudioBufferSourceNode | null) => {
    try {
      node?.disconnect();
    } catch {
      // Already disconnected by the browser.
    }
  };

  const createSourceNode = () => {
    const node = context.createBufferSource();
    node.buffer = buffer;
    node.connect(analyser);
    node.onended = () => {
      if (sourceNode !== node) {
        return;
      }

      playing = false;
      pauseOffset = 0;
      disconnectSource(node);
      sourceNode = null;
    };
    return node;
  };

  const stopSource = () => {
    const node = sourceNode;
    sourceNode = null;

    if (!node) {
      return;
    }

    try {
      node.stop();
    } catch {
      // A one-shot source may already have ended.
    }

    disconnectSource(node);
  };

  return {
    async play() {
      if (disposed || playing) {
        return;
      }

      sourceNode = createSourceNode();
      startedAt = context.currentTime - pauseOffset;
      playing = true;
      sourceNode.start(0, pauseOffset);
    },

    pause() {
      if (!playing) {
        return;
      }

      pauseOffset = Math.min(Math.max(context.currentTime - startedAt, 0), buffer.duration);
      playing = false;
      stopSource();
    },

    stop() {
      playing = false;
      pauseOffset = 0;
      stopSource();
    },

    sample() {
      if (playing) {
        analyser.getFloatTimeDomainData(samples);
      } else {
        samples.fill(0);
      }

      return {
        rms: calculateRms(samples),
        currentTime: playing
          ? Math.min(context.currentTime - startedAt, buffer.duration)
          : pauseOffset,
        duration: buffer.duration,
        playing
      };
    },

    async dispose() {
      disposed = true;
      playing = false;
      pauseOffset = 0;
      stopSource();
      analyser.disconnect();

      if (ownsContext) {
        await context.close();
      }
    }
  };
}
