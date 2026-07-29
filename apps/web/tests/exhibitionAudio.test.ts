import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExhibitionAudio } from '../src/exhibition/audio/ExhibitionAudio';

class FakeAudioParam {
  value = 1;
  cancelScheduledValues = vi.fn();
  setValueAtTime = vi.fn((value: number) => {
    this.value = value;
  });
  linearRampToValueAtTime = vi.fn((value: number) => {
    this.value = value;
  });
}

class FakeAudioNode {
  connect = vi.fn(() => this);
  disconnect = vi.fn();
}

class FakeGainNode extends FakeAudioNode {
  gain = new FakeAudioParam();
}

class FakePannerNode extends FakeAudioNode {
  positionX = new FakeAudioParam();
  positionY = new FakeAudioParam();
  positionZ = new FakeAudioParam();
  distanceModel = 'inverse';
  refDistance = 1;
  maxDistance = 10000;
  rolloffFactor = 1;
}

class FakeBufferSource extends FakeAudioNode {
  buffer: AudioBuffer | null = null;
  loop = false;
  onended: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn(() => this.onended?.());

  finish() {
    this.onended?.();
  }
}

class FakeAudioContext {
  state: AudioContextState = 'suspended';
  currentTime = 4;
  destination = new FakeAudioNode();
  sources: FakeBufferSource[] = [];
  gains: FakeGainNode[] = [];
  panners: FakePannerNode[] = [];
  resume = vi.fn(async () => {
    this.state = 'running';
  });

  createGain() {
    const node = new FakeGainNode();
    this.gains.push(node);
    return node as unknown as GainNode;
  }

  createPanner() {
    const node = new FakePannerNode();
    this.panners.push(node);
    return node as unknown as PannerNode;
  }

  createBufferSource() {
    const node = new FakeBufferSource();
    this.sources.push(node);
    return node as unknown as AudioBufferSourceNode;
  }
}

function buffer(id: string) {
  return { id } as unknown as AudioBuffer;
}

function createHarness(missing: string[] = []) {
  const context = new FakeAudioContext();
  const listener = {
    context,
    gain: new FakeGainNode()
  };
  const buffers = new Map<string, AudioBuffer>();
  for (const id of [
    'hall-ambience',
    'lake-ambience',
    'footstep-stone',
    'narration-bicycle',
    'narration-shuttle',
    'narration-tea-set',
    'narration-silk-garment'
  ]) {
    if (!missing.includes(id)) buffers.set(id, buffer(id));
  }
  return {
    audio: new ExhibitionAudio(listener as never, buffers),
    context,
    listener
  };
}

describe('ExhibitionAudio', () => {
  beforeEach(() => vi.clearAllMocks());

  it('waits for a user unlock before starting the selected ambience', async () => {
    const { audio, context } = createHarness();
    audio.setScene('hall');

    expect(audio.isUnlocked()).toBe(false);
    expect(context.sources).toHaveLength(0);

    await audio.unlock();

    expect(context.resume).toHaveBeenCalledTimes(1);
    expect(audio.isUnlocked()).toBe(true);
    expect(context.sources).toHaveLength(1);
    expect(context.sources[0]?.buffer).toEqual(buffer('hall-ambience'));
    expect(context.sources[0]?.loop).toBe(true);
  });

  it('ducks ambience during narration and restores it when narration ends', async () => {
    const { audio, context } = createHarness();
    audio.setScene('hall');
    await audio.unlock();

    expect(audio.playNarration('west-lake-bicycle')).toBe(true);
    expect(audio.getMix()).toMatchObject({ master: 1, narration: 1, ambience: 0.35 });
    context.sources.at(-1)?.finish();
    expect(audio.getMix().ambience).toBe(1);
  });

  it('switches ambience and places lake water in the positional field', async () => {
    const { audio, context } = createHarness();
    audio.setScene('hall');
    await audio.unlock();
    const hallSource = context.sources[0]!;

    audio.setScene('lake');
    audio.setWaterPosition(2, 0, -3);

    expect(hallSource.stop).toHaveBeenCalledTimes(1);
    expect(context.sources.at(-2)?.buffer).toEqual(buffer('lake-ambience'));
    expect(context.sources.at(-1)?.buffer).toEqual(buffer('lake-ambience'));
    expect(context.panners[0]?.positionX.value).toBe(2);
    expect(context.panners[0]?.positionZ.value).toBe(-3);
  });

  it('throttles footsteps by actual travelled distance and ignores stationary updates', async () => {
    const { audio, context } = createHarness();
    audio.setScene('hall');
    expect(audio.updateTravelledDistance(2)).toBe(false);
    await audio.unlock();
    const sourcesBeforeWalking = context.sources.length;

    expect(audio.updateTravelledDistance(0)).toBe(false);
    expect(audio.updateTravelledDistance(0.7)).toBe(false);
    expect(audio.updateTravelledDistance(0.8)).toBe(true);
    expect(context.sources).toHaveLength(sourcesBeforeWalking + 1);
    expect(context.sources.at(-1)?.buffer).toEqual(buffer('footstep-stone'));
  });

  it('treats missing buffers as silent failures and applies mute to the master mix', async () => {
    const { audio, context } = createHarness(['narration-shuttle', 'lake-ambience']);
    await audio.unlock();
    audio.setScene('lake');

    expect(() => audio.playNarration('green-mobility-car')).not.toThrow();
    expect(audio.playNarration('green-mobility-car')).toBe(false);
    expect(audio.getMix().ambience).toBe(1);

    audio.setMuted(true);
    expect(audio.getMix().master).toBe(0);
    expect(context.gains[0]?.gain.value).toBe(0);
  });

  it('stops sources and disconnects the graph exactly once', async () => {
    const { audio, context, listener } = createHarness();
    audio.setScene('hall');
    await audio.unlock();
    audio.playNarration('silk-and-tea');

    audio.dispose();
    audio.dispose();

    expect(context.sources.every((source) => source.stop.mock.calls.length <= 1)).toBe(true);
    expect(listener.gain.disconnect).toHaveBeenCalledTimes(1);
    expect(audio.isUnlocked()).toBe(false);
  });
});
