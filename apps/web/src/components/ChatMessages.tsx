// 消息列表渲染 Markdown、流式状态、附件预览和多格式导出操作。
import { useEffect, useRef, useState } from 'react';
import { Download, FileCode2, FileSpreadsheet, FileText, FileType2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import type { ChatMessage, GuideKnowledgeSource } from '../types/guide';
import { downloadGuideAnswer, type GuideExportFormat } from '../api/guideApi';

const CHAT_LOG_LABEL = '\u804a\u5929\u8bb0\u5f55';
const WELCOME_MESSAGE =
  '\u4f60\u597d\uff0c\u6211\u662f\u4e4c\u9547\u6570\u5b57\u5bfc\u6e38\u3002\u53ef\u4ee5\u95ee\u6211\u8def\u7ebf\u3001\u62cd\u7167\u70b9\u3001\u5f00\u653e\u65f6\u95f4\u6216\u4eb2\u5b50\u6e38\u5b89\u6392\u3002';
const LOCAL_FALLBACK_LABEL =
  '\u6a21\u578b\u54cd\u5e94\u8d85\u65f6\uff0c\u5df2\u5207\u6362\u4e3a\u672c\u5730\u8d44\u6599\u56de\u7b54\u3002';

type ChatMessagesProps = {
  messages: ChatMessage[];
  autoScroll?: boolean;
};

function getKnowledgeSourceLabel(source: GuideKnowledgeSource) {
  return source === 'destination-knowledge' ? '目的地知识库' : '本地景区资料';
}

const GUIDE_EXPORT_OPTIONS: Array<{
  format: GuideExportFormat;
  label: string;
  icon: typeof FileText;
}> = [
  { format: 'txt', label: '文本 (.txt)', icon: FileType2 },
  { format: 'word', label: 'Word (.rtf)', icon: FileText },
  { format: 'markdown', label: 'Markdown (.md)', icon: FileCode2 },
  { format: 'excel', label: 'Excel (.xlsx)', icon: FileSpreadsheet }
];

function GuideAnswerExport({ content }: { content: string }) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState<GuideExportFormat | null>(null);
  const [error, setError] = useState('');
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', closeOnOutsidePress);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  async function exportAnswer(format: GuideExportFormat) {
    setExporting(format);
    setError('');
    try {
      await downloadGuideAnswer(content, format);
      setOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '文件导出失败，请稍后重试。');
    } finally {
      setExporting(null);
    }
  }

  return (
    <div ref={rootRef} className="message-export">
      <button
        type="button"
        className="message-export-trigger"
        aria-label="导出回答"
        title="导出回答"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Download size={16} aria-hidden="true" />
        <span>导出</span>
      </button>
      {open ? (
        <div className="message-export-menu" role="menu" aria-label="选择导出格式">
          {GUIDE_EXPORT_OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.format}
                type="button"
                role="menuitem"
                disabled={exporting !== null}
                onClick={() => void exportAnswer(option.format)}
              >
                <Icon size={16} aria-hidden="true" />
                <span>{exporting === option.format ? '正在生成...' : option.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
      {error ? <span className="message-export-error">{error}</span> : null}
    </div>
  );
}

export function ChatMessages({ messages, autoScroll = true }: ChatMessagesProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!autoScroll) {
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    if (typeof container.scrollTo === 'function') {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [autoScroll, messages]);

  if (messages.length === 0) {
    return (
      <div
        ref={containerRef}
        className="chat-messages chat-messages-empty"
        aria-label={CHAT_LOG_LABEL}
      >
        <article className="message message-assistant">
          <span>Digital Guide</span>
          <p>{WELCOME_MESSAGE}</p>
        </article>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="chat-messages" aria-label={CHAT_LOG_LABEL}>
      {messages.map((message) => (
        <article
          key={message.id}
          className={`message message-${message.role} ${message.streaming ? 'message-streaming' : ''}`}
        >
          <span>{message.role === 'user' ? 'Visitor' : 'Digital Guide'}</span>
          {message.attachmentKind && message.attachmentKind !== 'image' ? (
            <div className="message-attachment">
              <FileText size={18} aria-hidden="true" />
              <span>{message.attachmentName ?? '用户上传附件'}</span>
            </div>
          ) : null}
          {message.attachmentPreviewUrl || message.imagePreviewUrl ? (
            <figure className="message-image">
              <img
                src={message.attachmentPreviewUrl ?? message.imagePreviewUrl}
                alt={message.attachmentName ?? message.imageName ?? '用户上传图片'}
              />
              {message.attachmentName || message.imageName ? (
                <figcaption>{message.attachmentName ?? message.imageName}</figcaption>
              ) : null}
            </figure>
          ) : null}
          {message.role === 'assistant' && !message.streaming ? (
            <div className="message-markdown">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                {message.content}
              </ReactMarkdown>
            </div>
          ) : (
            <p aria-live={message.streaming ? 'polite' : undefined}>
              {message.content}
              {message.streaming ? <i className="typewriter-caret" aria-hidden="true" /> : null}
            </p>
          )}
          {message.role === 'assistant' && !message.streaming && message.content ? (
            <GuideAnswerExport content={message.content} />
          ) : null}
          {message.role === 'assistant' && message.source === 'local-fallback' ? (
            <p className="message-source-notice" role="status">
              {LOCAL_FALLBACK_LABEL}
            </p>
          ) : null}
          {message.role === 'assistant' && message.retrievedKnowledge?.length ? (
            <div className="message-sources" aria-label="参考资料">
              <strong>参考资料</strong>
              <div>
                {message.retrievedKnowledge.slice(0, 3).map((knowledge) => (
                  <span key={knowledge.id} className="message-source-chip">
                    <em>{getKnowledgeSourceLabel(knowledge.source)}</em>
                    {knowledge.title}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}
