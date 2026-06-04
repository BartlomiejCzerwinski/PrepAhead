import { scoreQuiz } from './score-quiz';

function gradeQuestion(fieldset: HTMLFieldSetElement, selectedIndex: number): void {
  const correctIndex = Number(fieldset.dataset.correctIndex);
  const labels = fieldset.querySelectorAll<HTMLLabelElement>('.quiz-option-label');

  for (const label of labels) {
    label.classList.remove(
      'quiz-option--correct',
      'quiz-option--incorrect',
      'quiz-option--reveal-correct',
    );
    const input = label.querySelector<HTMLInputElement>('input[type="radio"]');
    if (!input) continue;

    const optionIndex = Number(input.value);
    input.disabled = true;

    if (optionIndex === selectedIndex && optionIndex === correctIndex) {
      label.classList.add('quiz-option--correct');
    } else if (optionIndex === selectedIndex) {
      label.classList.add('quiz-option--incorrect');
    } else if (optionIndex === correctIndex) {
      label.classList.add('quiz-option--reveal-correct');
    }
  }

  fieldset.dataset.answered = 'true';
}

function updateTotalScore(
  fieldsets: NodeListOf<HTMLFieldSetElement>,
  scorePanel: HTMLElement,
  scoreText: HTMLElement,
): void {
  const questions = Array.from(fieldsets).map((fieldset) => ({
    question: '',
    options: [],
    correctIndex: Number(fieldset.dataset.correctIndex),
  }));

  const selectedIndices = Array.from(fieldsets).map((fieldset) => {
    const checked = fieldset.querySelector<HTMLInputElement>(
      'input[type="radio"]:checked',
    );
    return checked ? Number(checked.value) : -1;
  });

  if (selectedIndices.some((value) => value < 0)) {
    return;
  }

  const result = scoreQuiz(questions, selectedIndices);
  scoreText.textContent = `${result.correct} / ${result.total} correct (${result.percent}%)`;
  scorePanel.classList.remove('hidden');
  scorePanel.setAttribute('aria-hidden', 'false');
}

export function initQuizPractice(): void {
  const practice = document.querySelector<HTMLElement>('.quiz-practice');
  const scorePanel = document.getElementById('quiz-practice-score');
  const scoreText = document.getElementById('quiz-score-text');

  if (!practice || !scorePanel || !scoreText) return;

  const fieldsets = practice.querySelectorAll<HTMLFieldSetElement>(
    'fieldset[data-correct-index]',
  );

  for (const fieldset of fieldsets) {
    fieldset.addEventListener('change', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || target.type !== 'radio') {
        return;
      }

      gradeQuestion(fieldset, Number(target.value));

      const allAnswered = Array.from(fieldsets).every(
        (item) => item.dataset.answered === 'true',
      );
      if (allAnswered) {
        updateTotalScore(fieldsets, scorePanel, scoreText);
        scorePanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  }
}
