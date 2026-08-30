import type { SupabaseClient } from '@supabase/supabase-js';

import {
  getAbcdProgress,
  getOpenEndedProgress,
  isPracticeSetFullyComplete,
  parsePracticeSetWithProgress,
  scoreAbcdPractice,
} from './contracts';

export const PRACTICE_SET_HISTORY_LIMIT = 50;

export type PracticeSetSummary = {
  id: string;
  title: string;
  createdAt: string;
  statusLabel: 'completed' | 'in_progress';
  contentReady: boolean;
  abcdAnswered: number;
  abcdTotal: 15;
  openEndedChecked: number;
  openEndedTotal: 5;
  abcdScorePercent: number | null;
  hasCv: boolean;
};

type PracticeSetRow = {
  id: string;
  title: string;
  status: string;
  content: unknown;
  created_at: string;
  cv_text: string | null;
};

/**
 * Map one raw `practice_sets` row to a history row view model.
 *
 * Tolerant by design: any throw from `parsePracticeSetWithProgress` degrades the
 * row to a `contentReady: false` placeholder instead of propagating. This catch
 * is intentionally broader than the single-set overview (`[id].astro:78-82`,
 * which re-throws non-contract errors): the parser can throw a raw `ZodError`
 * from its per-question `.parse()` (`contracts.ts:227,263`), and in a 50-row
 * list a single malformed/legacy row must not crash the whole page.
 */
export function toPracticeSetSummary(row: PracticeSetRow): PracticeSetSummary {
  const base = {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    abcdTotal: 15 as const,
    openEndedTotal: 5 as const,
    hasCv: typeof row.cv_text === 'string' && row.cv_text.length > 0,
  };

  const rawStatusLabel: 'completed' | 'in_progress' =
    row.status === 'completed' ? 'completed' : 'in_progress';

  try {
    const content = parsePracticeSetWithProgress(row.content);
    const abcdProgress = getAbcdProgress(content);
    const fullyComplete = isPracticeSetFullyComplete(content);

    return {
      ...base,
      statusLabel: row.status === 'completed' || fullyComplete ? 'completed' : 'in_progress',
      contentReady: true,
      abcdAnswered: abcdProgress.answeredCount,
      openEndedChecked: getOpenEndedProgress(content).checkedCount,
      abcdScorePercent: abcdProgress.isComplete ? scoreAbcdPractice(content).percent : null,
    };
  } catch {
    return {
      ...base,
      statusLabel: rawStatusLabel,
      contentReady: false,
      abcdAnswered: 0,
      openEndedChecked: 0,
      abcdScorePercent: null,
    };
  }
}

/**
 * Read a user's non-deleted practice sets, newest first, capped at `limit`.
 *
 * User-scoped (`user_id`) and soft-delete-aware (`deleted_at is null`); the
 * `(user_id, created_at desc) where deleted_at is null` partial index backs the
 * ordered, capped query. Never log raw rows or `cv_text` — `cv_text` is selected
 * only to derive `hasCv` and is sensitive (AGENTS.md).
 */
export async function listPracticeSetSummaries(
  supabase: SupabaseClient,
  userId: string,
  limit = PRACTICE_SET_HISTORY_LIMIT,
): Promise<{ ok: true; data: PracticeSetSummary[] } | { ok: false }> {
  const { data, error } = await supabase
    .from('practice_sets')
    .select('id, title, status, content, created_at, cv_text')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    return { ok: false };
  }

  const rows = (data ?? []) as PracticeSetRow[];
  return { ok: true, data: rows.map(toPracticeSetSummary) };
}
