import { useState } from 'react';
import {
  scoreQuiz,
  type QuizQuestion,
} from '../../lib/blog/score-quiz';

type Props = {
  quiz: QuizQuestion[];
};

export default function InteractiveQuiz({ quiz }: Props) {
  const [selected, setSelected] = useState<number[]>(() =>
    quiz.map(() => -1),
  );
  const [submitted, setSubmitted] = useState(false);

  const allAnswered = selected.every((value) => value >= 0);
  const result = submitted ? scoreQuiz(quiz, selected) : null;

  function selectOption(questionIndex: number, optionIndex: number) {
    if (submitted) return;
    setSelected((prev) => {
      const next = [...prev];
      next[questionIndex] = optionIndex;
      return next;
    });
  }

  return (
    <div className="interactive-quiz mt-8 space-y-8">
      {quiz.map((item, questionIndex) => (
        <fieldset
          key={questionIndex}
          className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6"
        >
          <legend className="mb-4 text-base font-semibold text-[var(--text)]">
            {questionIndex + 1}. {item.question}
          </legend>
          <div className="space-y-2">
            {item.options.map((option, optionIndex) => {
              const id = `q${questionIndex}-o${optionIndex}`;
              const checked = selected[questionIndex] === optionIndex;
              return (
                <label
                  key={id}
                  htmlFor={id}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm transition duration-200 ease-out ${
                    checked
                      ? 'border-brand-500/40 bg-[var(--brand-soft)]'
                      : 'border-[var(--border)] bg-[var(--surface-muted)] hover:border-brand-500/25'
                  }`}
                >
                  <input
                    id={id}
                    type="radio"
                    name={`question-${questionIndex}`}
                    className="mt-0.5"
                    checked={checked}
                    disabled={submitted}
                    onChange={() => selectOption(questionIndex, optionIndex)}
                  />
                  <span className="text-[var(--text)]">{option}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}

      {!submitted ? (
        <button
          type="button"
          className="btn-primary rounded-xl px-6 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!allAnswered}
          onClick={() => setSubmitted(true)}
        >
          See your score
        </button>
      ) : (
        result && (
          <div
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 text-center"
            role="status"
          >
            <p className="text-sm font-medium text-[var(--text-muted)]">Your result</p>
            <p className="mt-2 text-3xl font-bold text-[var(--text)]">
              {result.correct} / {result.total}
            </p>
            <p className="mt-1 text-lg text-[var(--brand)]">{result.percent}% correct</p>
          </div>
        )
      )}
    </div>
  );
}
