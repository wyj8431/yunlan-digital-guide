import { describe, expect, it } from 'vitest';
import { createGuideSpeechTimeline } from '../src/modules/guide/speech-timeline';

describe('createGuideSpeechTimeline', () => {
  it('creates ordered viseme cues for Chinese guide answers', () => {
    const timeline = createGuideSpeechTimeline('云岚古镇门票 60 元。');

    expect(timeline.text).toBe('云岚古镇门票 60 元。');
    expect(timeline.durationMs).toBeGreaterThanOrEqual(900);
    expect(timeline.source).toBe('estimated');
    expect(timeline.visemes.length).toBeGreaterThan(3);

    for (let index = 1; index < timeline.visemes.length; index += 1) {
      expect(timeline.visemes[index].startMs).toBeGreaterThanOrEqual(
        timeline.visemes[index - 1].startMs
      );
      expect(timeline.visemes[index].endMs).toBeGreaterThan(timeline.visemes[index].startMs);
    }

    expect(timeline.visemes[timeline.visemes.length - 1]).toMatchObject({
      viseme: 'mouth-closed',
      mouthOpen: 0
    });
  });
});
