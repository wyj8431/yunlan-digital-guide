import type { ChatMessage, ScenicAreaSummary } from '../types/guide';
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
  onAsk: (question: string) => void;
};

export function GuidePanel({ scenicArea, messages, loading, error, onAsk }: GuidePanelProps) {
  return (
    <section className="guide-panel" aria-label={GUIDE_PANEL_LABEL}>
      <header className="guide-panel-header">
        <div>
          <h2>{GUIDE_PANEL_TITLE}</h2>
          <p>AI Guide Chat</p>
        </div>
      </header>

      <ChatMessages messages={messages} />
      {error ? <p className="error-text">{error}</p> : null}
      <QuickQuestions questions={scenicArea.quickQuestions} disabled={loading} onAsk={onAsk} />
      <QuestionInput disabled={loading} onAsk={onAsk} />
    </section>
  );
}
