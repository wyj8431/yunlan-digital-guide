import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatMessages } from '../src/components/ChatMessages';

const CHAT_LOG_LABEL = '\u804a\u5929\u8bb0\u5f55';
const WELCOME_MESSAGE =
  '\u4f60\u597d\uff0c\u6211\u662f\u4e91\u5c9a\u53e4\u9547\u6570\u5b57\u5bfc\u6e38\u3002\u53ef\u4ee5\u95ee\u6211\u8def\u7ebf\u3001\u62cd\u7167\u70b9\u3001\u5f00\u653e\u65f6\u95f4\u6216\u4eb2\u5b50\u6e38\u5b89\u6392\u3002';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('ChatMessages', () => {
  it('renders the empty-state welcome copy in Chinese', () => {
    render(<ChatMessages messages={[]} />);

    expect(screen.getByLabelText(CHAT_LOG_LABEL)).toBeInTheDocument();
    expect(screen.getByText(WELCOME_MESSAGE)).toBeInTheDocument();
  });

  it('renders retrieved knowledge source chips for assistant messages', () => {
    render(
      <ChatMessages
        messages={[
          {
            id: 'assistant-1',
            role: 'assistant',
            content: '上海迪士尼亲子游详细攻略',
            retrievedKnowledge: [
              {
                id: 'destination:上海迪士尼度假区',
                title: '上海迪士尼度假区',
                source: 'destination-knowledge',
                content: '飞跃地平线',
                keywords: ['上海迪士尼度假区'],
                score: 100
              }
            ]
          }
        ]}
      />
    );

    expect(screen.getByText('参考资料')).toBeInTheDocument();
    expect(screen.getByText('上海迪士尼度假区')).toBeInTheDocument();
    expect(screen.getByText('目的地知识库')).toBeInTheDocument();
  });

  it('renders a document attachment as a file row instead of an image', () => {
    render(
      <ChatMessages
        messages={[
          {
            id: 'user-attachment',
            role: 'user',
            content: '请总结这份行程',
            attachmentName: 'hangzhou-plan.docx',
            attachmentKind: 'document'
          }
        ]}
      />
    );

    expect(screen.getByText('hangzhou-plan.docx')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders completed assistant Markdown as headings, paragraphs, and list items', () => {
    render(
      <ChatMessages
        messages={[
          {
            id: 'structured-answer',
            role: 'assistant',
            content: '### 核心结论\n\n这是归纳后的结论。\n\n- 第一个要点\n- 第二个要点'
          }
        ]}
      />
    );

    expect(screen.getByRole('heading', { level: 3, name: '核心结论' })).toBeInTheDocument();
    expect(screen.getByText('这是归纳后的结论。').tagName).toBe('P');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('does not jump to the end when automatic scrolling is disabled for history', () => {
    const scrollTo = vi.fn();
    const originalScrollTo = HTMLElement.prototype.scrollTo;
    HTMLElement.prototype.scrollTo = scrollTo;

    render(
      <ChatMessages
        autoScroll={false}
        messages={[{ id: 'history-message', role: 'assistant', content: '完整历史内容' }]}
      />
    );

    expect(scrollTo).not.toHaveBeenCalled();
    HTMLElement.prototype.scrollTo = originalScrollTo;
  });

  it('exports a completed assistant answer as text, Word, Markdown, or Excel', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['workbook']),
      headers: new Headers({
        'Content-Disposition': "attachment; filename*=UTF-8''guide-answer.xlsx"
      })
    });
    vi.stubGlobal('fetch', fetchMock);
    const createObjectURL = vi.fn().mockReturnValue('blob:guide-export');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    render(
      <ChatMessages
        messages={[{ id: 'export-answer', role: 'assistant', content: '杭州两日游详细方案' }]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '导出回答' }));
    expect(screen.getByRole('button', { name: '导出回答' })).toHaveTextContent('导出');
    expect(screen.getByRole('menuitem', { name: '文本 (.txt)' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Word (.rtf)' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Markdown (.md)' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Excel (.xlsx)' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/guide/export',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ content: '杭州两日游详细方案', format: 'excel' })
      })
    );
    expect(createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:guide-export');
  });
});
