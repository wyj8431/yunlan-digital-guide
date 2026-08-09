import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';

const fetchScenicAreaMock = vi.hoisted(() => vi.fn());
const streamGuideAnswerMock = vi.hoisted(() => vi.fn());
const speakMock = vi.hoisted(() => vi.fn());
const stopMock = vi.hoisted(() => vi.fn());

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
    speak: speakMock,
    stop: stopMock
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
    cleanup();
    localStorage.clear();
    vi.useRealTimers();
    fetchScenicAreaMock.mockReset();
    streamGuideAnswerMock.mockReset();
    speakMock.mockReset();
    stopMock.mockReset();
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

  it('does not replay the current answer after opening chat history', async () => {
    const { rerender } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Ask guide' }));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(speakMock).toHaveBeenCalledWith('abcdef');

    rerender(<App activeView="history" onNavigate={vi.fn()} />);

    expect(stopMock).toHaveBeenCalled();
    expect(speakMock).toHaveBeenCalledTimes(1);

    rerender(<App activeView="explore" />);

    expect(speakMock).toHaveBeenCalledTimes(1);
  });

  it('keeps destination links available while Explore scenic data is loading', () => {
    fetchScenicAreaMock.mockReturnValueOnce(new Promise(() => {}));

    render(<App />);

    expect(screen.getByRole('link', { name: '3D 展馆' })).toHaveAttribute('href', '/exhibition');
    expect(screen.getByRole('link', { name: '视频中心' })).toHaveAttribute('href', '/videos');
  });

  it('keeps destination links available when Explore scenic data fails', async () => {
    fetchScenicAreaMock.mockRejectedValueOnce(new Error('offline'));

    render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole('link', { name: '3D 展馆' })).toHaveAttribute('href', '/exhibition');
    expect(screen.getByRole('link', { name: '视频中心' })).toHaveAttribute('href', '/videos');
  });

  it('does not add destination links to a non-Explore loading route', () => {
    fetchScenicAreaMock.mockReturnValueOnce(new Promise(() => {}));

    render(<App activeView="home" />);

    expect(screen.queryByRole('link', { name: '3D 展馆' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '视频中心' })).not.toBeInTheDocument();
  });

  it('places destination links after the Explore title for narrow-screen flow', async () => {
    const { container } = render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    const title = container.querySelector('.app-title');
    const destinationLinks = container.querySelector('.home-destination-links');

    expect(title).not.toBeNull();
    expect(destinationLinks).not.toBeNull();
    expect(
      title!.compareDocumentPosition(destinationLinks!) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('renders a dedicated page for a non-Explore route', async () => {
    const onNavigate = vi.fn();
    const { container } = render(<App activeView="home" onNavigate={onNavigate} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.querySelector('main[data-tourism-page="home"]')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '今日乌镇' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '今天，从水上醒来' })).toBeInTheDocument();
    expect(screen.queryByLabelText('digital human stage')).not.toBeInTheDocument();
    expect(container.querySelector('.holo-view-panel')).not.toBeInTheDocument();
  });

  it('opens conversation history from the Explore chat header', async () => {
    const onNavigate = vi.fn();
    render(<App onNavigate={onNavigate} />);

    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole('button', { name: '查看历史记录' }));

    expect(onNavigate).toHaveBeenCalledWith('history');
  });

  it('renders saved conversations on the dedicated history page', async () => {
    localStorage.setItem(
      'yunlan-guide-chat-history-v1',
      JSON.stringify([
        {
          id: 'saved-session',
          title: '杭州两日游',
          createdAt: '2026-07-27T10:00:00.000Z',
          updatedAt: '2026-07-27T10:05:00.000Z',
          messages: [{ id: 'question', role: 'user', content: '杭州两日游怎么安排？' }]
        }
      ])
    );

    render(<App activeView="history" onNavigate={vi.fn()} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole('heading', { name: '对话历史' })).toBeInTheDocument();
    expect(screen.getAllByText('杭州两日游')).toHaveLength(2);
  });

  it('keeps local conversation history available when scenic data is offline', async () => {
    fetchScenicAreaMock.mockRejectedValueOnce(new Error('offline'));
    localStorage.setItem(
      'yunlan-guide-chat-history-v1',
      JSON.stringify([
        {
          id: 'offline-session',
          title: '离线可看的记录',
          createdAt: '2026-07-27T10:00:00.000Z',
          updatedAt: '2026-07-27T10:05:00.000Z',
          messages: [{ id: 'question', role: 'user', content: '离线问题' }]
        }
      ])
    );

    render(<App activeView="history" onNavigate={vi.fn()} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole('heading', { name: '对话历史' })).toBeInTheDocument();
    expect(screen.getAllByText('离线可看的记录')).toHaveLength(2);
  });
});
