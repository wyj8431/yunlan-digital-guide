import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QuestionInput } from '../src/components/QuestionInput';

const VOICE_INPUT_LABEL = '\u8bed\u97f3\u8f93\u5165';
const STOP_VOICE_INPUT_LABEL = '\u505c\u6b62\u8bed\u97f3\u8f93\u5165';
const ATTACHMENT_FILE_INPUT_LABEL = '选择附件文件';
const UNSUPPORTED_HINT =
  '\u5f53\u524d\u6d4f\u89c8\u5668\u4e0d\u652f\u6301\u8bed\u97f3\u8f93\u5165\uff0c\u53ef\u4ee5\u76f4\u63a5\u6253\u5b57\u63d0\u95ee\u3002';
const INTRO_QUESTION = '\u8bf7\u4ecb\u7ecd\u4e00\u4e0b\u53e4\u9547\u666f\u533a';
const ROUTE_QUESTION = '\u5e2e\u6211\u89c4\u5212\u4e00\u6761\u8def\u7ebf';
const TICKET_QUESTION = '\u95e8\u7968\u591a\u5c11\u94b1';

let activeRecognition: MockSpeechRecognition | null = null;

class MockSpeechRecognition {
  lang = '';
  continuous = false;
  interimResults = false;
  onresult: ((event: SpeechRecognitionEvent) => void) | null = null;
  onend: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onnomatch: ((event: Event) => void) | null = null;
  onspeechend: ((event: Event) => void) | null = null;
  onaudioend: ((event: Event) => void) | null = null;
  start = vi.fn(() => {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    activeRecognition = this;
  });
  stop = vi.fn(() => {
    this.onend?.(new Event('end'));
  });
  abort = vi.fn();

  emitResult(transcript: string, isFinal = true) {
    const result = {
      isFinal,
      length: 1,
      0: { transcript, confidence: 0.99 }
    } as unknown as SpeechRecognitionResult;

    const event = {
      resultIndex: 0,
      results: {
        length: 1,
        0: result
      }
    } as unknown as SpeechRecognitionEvent;

    this.onresult?.(event);
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  activeRecognition = null;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  delete window.SpeechRecognition;
  delete window.webkitSpeechRecognition;
  activeRecognition = null;
});

describe('QuestionInput', () => {
  it('submits recognized speech as a question when recognition ends', () => {
    const onAsk = vi.fn();
    window.SpeechRecognition = MockSpeechRecognition as unknown as typeof window.SpeechRecognition;

    render(<QuestionInput disabled={false} onAsk={onAsk} />);

    fireEvent.click(screen.getByRole('button', { name: VOICE_INPUT_LABEL }));
    act(() => {
      activeRecognition?.emitResult(INTRO_QUESTION);
      activeRecognition?.onend?.(new Event('end'));
    });

    expect(onAsk).toHaveBeenCalledWith(INTRO_QUESTION, null);
  });

  it('auto-sends after a short silence even if the browser does not end recognition', () => {
    const onAsk = vi.fn();
    window.SpeechRecognition = MockSpeechRecognition as unknown as typeof window.SpeechRecognition;

    render(<QuestionInput disabled={false} onAsk={onAsk} />);

    fireEvent.click(screen.getByRole('button', { name: VOICE_INPUT_LABEL }));
    act(() => {
      activeRecognition?.emitResult(ROUTE_QUESTION);
    });

    expect(screen.getByDisplayValue(ROUTE_QUESTION)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1300);
    });

    expect(onAsk).toHaveBeenCalledWith(ROUTE_QUESTION, null);
  });

  it('submits the current transcript when the user taps stop', () => {
    const onAsk = vi.fn();
    window.SpeechRecognition = MockSpeechRecognition as unknown as typeof window.SpeechRecognition;

    render(<QuestionInput disabled={false} onAsk={onAsk} />);

    fireEvent.click(screen.getByRole('button', { name: VOICE_INPUT_LABEL }));
    act(() => {
      activeRecognition?.emitResult(TICKET_QUESTION, false);
    });
    fireEvent.click(screen.getByRole('button', { name: STOP_VOICE_INPUT_LABEL }));

    expect(onAsk).toHaveBeenCalledWith(TICKET_QUESTION, null);
  });

  it('submits an uploaded image with the typed question', async () => {
    vi.useRealTimers();
    const onAsk = vi.fn();
    render(<QuestionInput disabled={false} onAsk={onAsk} />);

    const image = new File(['fake-image'], 'wuzhen.webp', { type: 'image/webp' });
    fireEvent.change(screen.getByLabelText(ATTACHMENT_FILE_INPUT_LABEL), {
      target: { files: [image] }
    });

    await waitFor(() => {
      expect(screen.getByText('wuzhen.webp')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('向数字导游提问'), {
      target: { value: '这张图片适合走哪条路线？' }
    });
    fireEvent.submit(screen.getByRole('button', { name: '发送问题' }).closest('form')!);

    expect(onAsk).toHaveBeenCalledWith(
      '这张图片适合走哪条路线？',
      expect.objectContaining({
        name: 'wuzhen.webp',
        mimeType: 'image/webp',
        dataUrl: expect.stringContaining('data:image/webp;base64,')
      })
    );
  });

  it('accepts images, Word, PowerPoint, Excel, CSV and Markdown files', () => {
    render(<QuestionInput disabled={false} onAsk={vi.fn()} />);

    const accept = screen.getByLabelText(ATTACHMENT_FILE_INPUT_LABEL).getAttribute('accept') ?? '';
    for (const extension of ['.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.csv', '.md']) {
      expect(accept).toContain(extension);
    }
    expect(accept).toContain('image/png');
  });

  it('submits a Markdown attachment and renders it as a file instead of an image', async () => {
    vi.useRealTimers();
    const onAsk = vi.fn();
    render(<QuestionInput disabled={false} onAsk={onAsk} />);

    const markdown = new File(['# 杭州行程\n西湖日落'], 'hangzhou.md', {
      type: 'text/markdown'
    });
    fireEvent.change(screen.getByLabelText(ATTACHMENT_FILE_INPUT_LABEL), {
      target: { files: [markdown] }
    });

    await waitFor(() => expect(screen.getByText('hangzhou.md')).toBeInTheDocument());
    expect(
      screen.getByText('hangzhou.md').closest('.question-attachment-preview')?.querySelector('img')
    ).toBeNull();

    fireEvent.change(screen.getByLabelText('向数字导游提问'), {
      target: { value: '总结这份行程' }
    });
    fireEvent.submit(screen.getByRole('button', { name: '发送问题' }).closest('form')!);

    expect(onAsk).toHaveBeenCalledWith(
      '总结这份行程',
      expect.objectContaining({
        name: 'hangzhou.md',
        mimeType: 'text/markdown',
        kind: 'markdown',
        dataUrl: expect.stringContaining('data:text/markdown;base64,')
      })
    );
  });

  it('shows a helpful hint when speech recognition is unavailable', () => {
    const onAsk = vi.fn();

    render(<QuestionInput disabled={false} onAsk={onAsk} />);

    expect(screen.getByText(UNSUPPORTED_HINT)).toBeInTheDocument();
  });
});
