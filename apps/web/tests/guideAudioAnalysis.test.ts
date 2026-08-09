import { afterEach, describe, expect, it } from 'vitest';
import {
  connectGuideAudioAnalysis,
  disconnectGuideAudioAnalysis,
  resetGuideAudioAnalysis,
  sampleGuideAudioAnalysis
} from '../src/lib/guideAudioAnalysis';

class FakeAnalyser {
  fftSize = 32;
  disconnected = false;
  connectedTo: unknown[] = [];

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

class FakeSource {
  connectedTo: unknown[] = [];

  connect(target: unknown) {
    this.connectedTo.push(target);
  }
}

class FakeAudioContext {
  destination = {};
  analysers: FakeAnalyser[] = [];

  createAnalyser() {
    const analyser = new FakeAnalyser();
    this.analysers.push(analyser);
    return analyser;
  }
}

afterEach(() => resetGuideAudioAnalysis());

describe('guideAudioAnalysis', () => {
  it('reports an idle snapshot without an active playback source', () => {
    expect(sampleGuideAudioAnalysis()).toEqual({ playbackId: null, playing: false, rms: 0 });
  });

  it('routes the source through an analyser and returns its RMS signal', () => {
    const context = new FakeAudioContext();
    const source = new FakeSource();

    connectGuideAudioAnalysis(
      context as unknown as AudioContext,
      source as unknown as AudioBufferSourceNode,
      'playback-1'
    );

    const snapshot = sampleGuideAudioAnalysis();
    expect(snapshot.playbackId).toBe('playback-1');
    expect(snapshot.playing).toBe(true);
    expect(snapshot.rms).toBeCloseTo(0.25);
    expect(source.connectedTo).toHaveLength(1);
    expect(context.analysers[0]?.connectedTo).toEqual([context.destination]);
  });

  it('does not disconnect a newer source when an older playback is cleaned up', () => {
    const context = new FakeAudioContext();
    const firstSource = new FakeSource();
    const secondSource = new FakeSource();

    connectGuideAudioAnalysis(
      context as unknown as AudioContext,
      firstSource as unknown as AudioBufferSourceNode,
      'first'
    );
    const firstAnalyser = context.analysers[0];
    connectGuideAudioAnalysis(
      context as unknown as AudioContext,
      secondSource as unknown as AudioBufferSourceNode,
      'second'
    );

    disconnectGuideAudioAnalysis('first');
    expect(firstAnalyser?.disconnected).toBe(true);
    expect(sampleGuideAudioAnalysis().playbackId).toBe('second');
  });
});
