type QuickQuestionsProps = {
  questions: string[];
  disabled: boolean;
  onAsk: (question: string) => void;
};

export function QuickQuestions({ questions, disabled, onAsk }: QuickQuestionsProps) {
  return (
    <div className="quick-questions" aria-label="快捷问题">
      {questions.map((question) => (
        <button key={question} type="button" disabled={disabled} onClick={() => onAsk(question)}>
          {question}
        </button>
      ))}
    </div>
  );
}
