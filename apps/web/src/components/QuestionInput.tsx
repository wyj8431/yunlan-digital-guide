import { FormEvent, useState } from 'react';

type QuestionInputProps = {
  disabled: boolean;
  onAsk: (question: string) => void;
};

export function QuestionInput({ disabled, onAsk }: QuestionInputProps) {
  const [question, setQuestion] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = question.trim();

    if (!trimmed) {
      return;
    }

    onAsk(trimmed);
    setQuestion('');
  }

  return (
    <form className="question-input" onSubmit={handleSubmit}>
      <input
        value={question}
        disabled={disabled}
        onChange={(event) => setQuestion(event.target.value)}
        placeholder="向数字导游提问"
        aria-label="向数字导游提问"
      />
      <button type="submit" disabled={disabled || !question.trim()} aria-label="发送问题">
        →
      </button>
    </form>
  );
}
