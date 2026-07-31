// 提供固定高频问题，减少首次使用时的输入成本。
const QUICK_QUESTIONS_LABEL = '\u5feb\u6377\u95ee\u9898';

type QuickQuestionsProps = {
  questions: string[];
  disabled: boolean;
  onAsk: (question: string) => void;
};

export function QuickQuestions({ questions, disabled, onAsk }: QuickQuestionsProps) {
  return (
    <div className="quick-questions" aria-label={QUICK_QUESTIONS_LABEL}>
      {questions.map((question) => (
        <button key={question} type="button" disabled={disabled} onClick={() => onAsk(question)}>
          {question}
        </button>
      ))}
    </div>
  );
}
