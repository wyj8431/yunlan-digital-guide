import { describe, expect, it, vi } from 'vitest';
import { createAudioAnalysisSession, readAudioSource } from '../src/lab/lip-sync/audio/audioSource';

class FakeAnalyserNode {
  fftSize = 32;
  connectedTo: unknown[] = [];
  disconnected = false;

  connect(target: unknown) {
    this.connectedTo.push(target);
  }

  disconnect() {
    this.disconnected = true;
  }

  getFloatTimeDomainData(samples: Float32Array) {
    samples.fill(0.25);
  }
}

class FakeAudioBufferSourceNode {
  connectedTo: unknown[] = [];
  disconnected = false;
  started: { when: number; offset?: number } | null = null;
  stopped = false;
  buffer: AudioBuffer | null = null;
  onended: (() => void) | null = null;

  connect(target: unknown) {
    this.connectedTo.push(target);
  }

  disconnect() {
    this.disconnected = true;
  }

  start(when: number, offset?: number) {
    this.started = { when, offset };
  }

  stop() {
    this.stopped = true;
    this.onended?.();
  }
}

class FakeAudioBuffer {
  readonly channels: Float32Array[];

  constructor(
    public readonly numberOfChannels: number,
    public readonly length: number,
    public readonly sampleRate: number
  ) {
    this.channels = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
  }

  get duration() {
    return this.length / this.sampleRate;
  }

  getChannelData(channel: number) {
    return this.channels[channel];
  }
}

class FakeAudioContext {
  currentTime = 0;
  destination = {};
  closed = false;
  readonly sources: FakeAudioBufferSourceNode[] = [];
  readonly analysers: FakeAnalyserNode[] = [];
  readonly mediaSources: Array<{
    disconnected: boolean;
    connect(target: unknown): void;
    disconnect(): void;
  }> = [];
  state: 'running' | 'suspended' = 'running';

  constructor(public readonly sampleRate = 16_000) {}

  createAnalyser() {
    const analyser = new FakeAnalyserNode();
    this.analysers.push(analyser);
    return analyser;
  }

  createBuffer(numberOfChannels: number, length: number, sampleRate: number) {
    return new FakeAudioBuffer(numberOfChannels, length, sampleRate);
  }

  createBufferSource() {
    const source = new FakeAudioBufferSourceNode();
    this.sources.push(source);
    return source;
  }

  createMediaStreamSource() {
    const source = {
      disconnected: false,
      connect: () => undefined,
      disconnect() {
        this.disconnected = true;
      }
    };
    this.mediaSources.push(source);
    return source;
  }

  async resume() {
    this.state = 'running';
  }

  async decodeAudioData() {
    return this.createBuffer(1, this.sampleRate, this.sampleRate);
  }

  async close() {
    this.closed = true;
  }
}

describe('readAudioSource', () => {
  it('reads a local file without fetch', async () => {
    const file = {
      arrayBuffer: vi.fn().mockResolvedValue(Uint8Array.from([1, 2, 3]).buffer)
    } as unknown as File;
    const fetcher = vi.fn();

    const result = await readAudioSource({ kind: 'file', file }, fetcher);

    expect(new Uint8Array(result)).toEqual(new Uint8Array([1, 2, 3]));
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects a failed URL response with a source-specific message', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 403 }));

    await expect(
      readAudioSource({ kind: 'url', url: 'https://audio.test/a.mp3' }, fetcher)
    ).rejects.toThrow('Audio URL failed to load: 403');
  });
});

describe('createAudioAnalysisSession', () => {
  it('creates a deterministic six-second preset with quiet and loud windows', async () => {
    const context = new FakeAudioContext();

    const session = await createAudioAnalysisSession(
      { kind: 'preset' },
      { context: context as unknown as AudioContext }
    );
    await session.play();

    const buffer = context.sources[0]?.buffer as unknown as FakeAudioBuffer | undefined;
    expect(buffer?.duration).toBe(6);
    expect(buffer?.getChannelData(0).some((sample) => Math.abs(sample) < 0.001)).toBe(true);
    expect(buffer?.getChannelData(0).some((sample) => Math.abs(sample) > 0.1)).toBe(true);
  });

  it('stops playback and disconnects audio nodes on dispose', async () => {
    const context = new FakeAudioContext();
    const session = await createAudioAnalysisSession(
      { kind: 'preset' },
      { context: context as unknown as AudioContext }
    );

    await session.play();
    expect(session.sample().playing).toBe(true);

    session.stop();
    expect(session.sample().playing).toBe(false);

    await session.dispose();
    expect(context.sources.every((source) => source.disconnected)).toBe(true);
    expect(context.analysers.every((analyser) => analyser.disconnected)).toBe(true);
  });

  it('samples a microphone stream and closes its tracks on dispose', async () => {
    const context = new FakeAudioContext();
    const track = { stop: vi.fn() };
    const mediaDevices = { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [track] }) };
    const session = await createAudioAnalysisSession(
      { kind: 'microphone' },
      { context: context as unknown as AudioContext, mediaDevices }
    );

    await session.play();
    expect(session.sample().playing).toBe(true);
    await session.dispose();

    expect(track.stop).toHaveBeenCalledOnce();
    expect(context.mediaSources.every((source) => source.disconnected)).toBe(true);
  });
});
