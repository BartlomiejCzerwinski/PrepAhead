import { useEffect, useRef, type RefObject } from 'react';

import { questionDotAriaLabel, type QuestionDotStatus } from '../../lib/practice/question-dot-status';
import type { QuestionCategory } from '../../lib/practice/practice-set-navigation';
import { ABCD_QUESTION_COUNT } from '../../lib/practice/practice-set-navigation';

export type QuestionSidebarItem = {
  prompt: string;
  status: QuestionDotStatus;
  category: QuestionCategory;
};

type SectionProgress = {
  completed: number;
  total: number;
};

type Props = {
  items: QuestionSidebarItem[];
  currentIndex: number;
  onSelect: (index: number) => void;
  disabled?: boolean;
  className?: string;
  abcdProgress: SectionProgress;
  openEndedProgress: SectionProgress;
};

function mapButtonClass(
  status: QuestionDotStatus,
  category: QuestionCategory,
  isCurrent: boolean,
): string {
  const shape = category === 'abcd' ? 'rounded-full' : 'rounded-lg';
  const base = `flex h-8 w-8 items-center justify-center text-xs font-semibold transition ${shape}`;

  if (isCurrent) {
    if (status === 'unanswered' || status === 'draft') {
      return `${base} border-2 border-[var(--brand)] bg-[var(--surface)] text-[var(--brand)] shadow-sm ring-2 ring-[var(--brand)]/25 ring-offset-1 ring-offset-[var(--surface-elevated)]`;
    }

    return `${base} bg-[var(--brand)] text-white shadow-sm ring-2 ring-[var(--brand)] ring-offset-1 ring-offset-[var(--surface-elevated)]`;
  }

  switch (status) {
    case 'answered':
    case 'checked':
      return `${base} bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)]`;
    case 'draft':
      return `${base} border border-[var(--brand)]/40 bg-[var(--brand-soft)] text-[var(--brand)] hover:border-[var(--brand)]`;
    case 'unanswered':
    default:
      return `${base} border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:border-[var(--brand)]/35 hover:text-[var(--text)]`;
  }
}

function MapSection({
  label,
  progress,
  items,
  startIndex,
  currentIndex,
  disabled,
  onSelect,
  activeItemRef,
}: {
  label: string;
  progress: SectionProgress;
  items: QuestionSidebarItem[];
  startIndex: number;
  currentIndex: number;
  disabled: boolean;
  onSelect: (index: number) => void;
  activeItemRef: RefObject<HTMLButtonElement | null>;
}) {
  const columns = items.length <= 5 ? items.length : 5;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          {label}
        </p>
        <span className="text-[0.65rem] font-medium text-[var(--text-muted)]">
          {progress.completed}/{progress.total}
        </span>
      </div>
      <ul
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {items.map((item, offset) => {
          const index = startIndex + offset;
          const isCurrent = index === currentIndex;

          return (
            <li key={index} className="flex justify-center">
              <button
                ref={isCurrent ? activeItemRef : undefined}
                type="button"
                title={item.prompt.trim()}
                aria-label={questionDotAriaLabel(index, item.status, item.category)}
                aria-current={isCurrent ? 'step' : undefined}
                disabled={disabled}
                onClick={() => onSelect(index)}
                className={`${mapButtonClass(item.status, item.category, isCurrent)} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {index + 1}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function QuestionSidebar({
  items,
  currentIndex,
  onSelect,
  disabled = false,
  className = '',
  abcdProgress,
  openEndedProgress,
}: Props) {
  const activeItemRef = useRef<HTMLButtonElement>(null);
  const abcdItems = items.slice(0, ABCD_QUESTION_COUNT);
  const openEndedItems = items.slice(ABCD_QUESTION_COUNT);

  useEffect(() => {
    activeItemRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentIndex]);

  return (
    <nav aria-label="Questions" className={`space-y-3 ${className}`.trim()}>
      <MapSection
        label="Multiple choice"
        progress={abcdProgress}
        items={abcdItems}
        startIndex={0}
        currentIndex={currentIndex}
        disabled={disabled}
        onSelect={onSelect}
        activeItemRef={activeItemRef}
      />
      <MapSection
        label="Open-ended"
        progress={openEndedProgress}
        items={openEndedItems}
        startIndex={ABCD_QUESTION_COUNT}
        currentIndex={currentIndex}
        disabled={disabled}
        onSelect={onSelect}
        activeItemRef={activeItemRef}
      />
      <div className="space-y-0.5 border-t border-[var(--border)] pt-2 text-[0.625rem] leading-4 text-[var(--text-muted)]">
        <p>
          Multiple choice {abcdProgress.completed}/{abcdProgress.total}
        </p>
        <p>
          Open-ended {openEndedProgress.completed}/{openEndedProgress.total}
        </p>
      </div>
    </nav>
  );
}
