// 导游侧栏组合消息列表、快捷问题和多模态提问输入。
import type { ChatMessage, GuideAttachment, ScenicAreaSummary } from '../types/guide';
import type { VoiceGuideState } from '../voice/useVoiceGuideSession';
import { ChatMessages } from './ChatMessages';
import { QuestionInput } from './QuestionInput';
import { QuickQuestions } from './QuickQuestions';

const GUIDE_PANEL_LABEL = 'AI \u6570\u5b57\u5bfc\u6e38\u95ee\u7b54';
const GUIDE_PANEL_TITLE = '\u5bf9\u8bdd\u5bfc\u89c8';

type GuidePanelProps = {
  scenicArea: ScenicAreaSummary;
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  onAsk: (question: string, attachment?: GuideAttachment | null) => void;
  voice?: VoiceGuideState;
  onNewConversation?: () => void;
  onOpenHistory?: () => void;
};

export function GuidePanel({
  scenicArea,
  messages,
  loading,
  error,
  onAsk,
  voice,
  onNewConversation,
  onOpenHistory
}: GuidePanelProps) {
  return (
    <section className="guide-panel" aria-label={GUIDE_PANEL_LABEL}>
      <header className="guide-panel-header">
        <div>
          <h2>{GUIDE_PANEL_TITLE}</h2>
          <p>AI Guide Chat</p>
        </div>
        <div className="guide-panel-tools">
          <button type="button" aria-label="新建对话" title="新建对话" onClick={onNewConversation}>
            <MessageSquarePlus size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="查看历史记录"
            title="查看历史记录"
            onClick={onOpenHistory}
          >
            <History size={18} aria-hidden="true" />
          </button>
        </div>
      </header>

      <ChatMessages messages={messages} />
      {error ? <p className="error-text">{error}</p> : null}
      <QuickQuestions questions={scenicArea.quickQuestions} disabled={loading} onAsk={onAsk} />
      <QuestionInput disabled={loading} onAsk={onAsk} voice={voice} />
    </section>
  );
}
import { History, MessageSquarePlus } from 'lucide-react';
