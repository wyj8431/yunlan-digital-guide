import type { ChatMessage, RouteCard, ScenicAreaSummary } from '../types/guide';
import { ChatMessages } from './ChatMessages';
import { QuestionInput } from './QuestionInput';
import { QuickQuestions } from './QuickQuestions';
import { RouteCards } from './RouteCards';

type GuidePanelProps = {
  scenicArea: ScenicAreaSummary;
  messages: ChatMessage[];
  routeCards: RouteCard[];
  loading: boolean;
  error: string | null;
  onAsk: (question: string) => void;
};

export function GuidePanel({
  scenicArea,
  messages,
  routeCards,
  loading,
  error,
  onAsk
}: GuidePanelProps) {
  return (
    <section className="guide-panel" aria-label="AI 数字导游问答">
      <header>
        <p className="eyebrow">AI 数字导游</p>
        <h1>{scenicArea.scenicArea.name}</h1>
        <p className="intro">{scenicArea.scenicArea.description}</p>
        <div className="meta-row">
          <span>{scenicArea.scenicArea.openingHours}</span>
          <span>{scenicArea.scenicArea.ticketInfo}</span>
        </div>
      </header>

      <QuickQuestions questions={scenicArea.quickQuestions} disabled={loading} onAsk={onAsk} />
      <ChatMessages messages={messages} />
      {error ? <p className="error-text">{error}</p> : null}
      <QuestionInput disabled={loading} onAsk={onAsk} />
      <RouteCards cards={routeCards} />
    </section>
  );
}
