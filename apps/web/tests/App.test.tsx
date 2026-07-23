import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';

const fetchScenicAreaMock = vi.hoisted(() => vi.fn());
const streamGuideAnswerMock = vi.hoisted(() => vi.fn());
const speakMock = vi.hoisted(() => vi.fn());

const speechTimeline = {
  text: 'abcdef',
  durationMs: 900,
  visemes: [{ startMs: 0, endMs: 120, viseme: 'aa', mouthOpen: 0.6 }],
  source: 'estimated'
} as const;

vi.mock('../src/api/guideApi', () => ({
  fetchScenicArea: fetchScenicAreaMock,
  streamGuideAnswer: streamGuideAnswerMock
}));

vi.mock('../src/hooks/useSpeechSynthesis', () => ({
  useSpeechSynthesis: () => ({
    supported: true,
    speaking: false,
    speak: speakMock
  })
}));

vi.mock('../src/components/DigitalHumanStage', () => ({
  DigitalHumanStage: () => <div aria-label="digital human stage" />
}));

vi.mock('../src/components/ScenicPanel', () => ({
  ScenicPanel: () => <aside aria-label="scenic panel" />
}));

describe('App speech and typewriter sync', () => {
  beforeEach(() => {
    fetchScenicAreaMock.mockResolvedValue({
      scenicArea: {
        id: 'wuzhen-scenic-area',
        name: 'Wuzhen',
        description: 'Water town',
        openingHours: '09:00-21:00',
        ticketInfo: '60'
      },
      spots: [],
      routes: [],
      services: [],
      quickQuestions: ['Ask guide']
    });
    streamGuideAnswerMock.mockImplementation((_message, _image, handlers) => {
      handlers.onResult({
        answer: 'abcdef',
        cards: [],
        source: 'local-fallback',
        speechTimeline
      });
      handlers.onDone?.();

      return { close: vi.fn() };
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    fetchScenicAreaMock.mockReset();
    streamGuideAnswerMock.mockReset();
    speakMock.mockReset();
  });

  it('starts speech once while the typewriter keeps updating the answer', async () => {
    vi.useFakeTimers();
    render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    const quickQuestion = screen.getByRole('button', { name: 'Ask guide' });

    fireEvent.click(quickQuestion);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(speakMock).toHaveBeenCalledWith('abcdef');

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(speakMock).toHaveBeenCalledTimes(1);
  });
});
