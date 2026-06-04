export type QuizQuestion = {
  question: string;
  options: string[];
  correctIndex: number;
};

export type QuizScore = {
  correct: number;
  total: number;
  percent: number;
};

export function scoreQuiz(
  questions: QuizQuestion[],
  selectedIndices: number[],
): QuizScore {
  const total = questions.length;
  let correct = 0;

  for (let i = 0; i < total; i++) {
    if (selectedIndices[i] === questions[i]?.correctIndex) {
      correct += 1;
    }
  }

  const percent = total === 0 ? 0 : Math.round((correct / total) * 100);
  return { correct, total, percent };
}
