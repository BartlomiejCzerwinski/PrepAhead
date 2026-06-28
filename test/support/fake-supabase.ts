import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * In-process fake for the Supabase client surface the API routes use.
 *
 * The real client is built per-request by `createSupabaseServerClient`
 * (`src/lib/supabase/server.ts`). Integration tests `vi.mock` that factory and
 * return one of these fakes, so a route handler runs unchanged against seeded
 * data — no network, no DB, no Docker. We mock at the client boundary because
 * that is where the app injects Supabase (research "Architecture Insights").
 */

export type TerminalResult = {
  data?: unknown;
  error?: unknown;
};

type TableSeed = {
  /** Result for read chains: `.from(t).select(...).eq(...).maybeSingle()`. */
  select?: TerminalResult;
  /** Result for write-then-read: `.from(t).insert(...).select(...).single()`. */
  insert?: TerminalResult;
  /** Result for write-then-read: `.from(t).update(...).eq(...).select('id')`. */
  update?: TerminalResult;
  /** Result for `.from(t).delete()...`. */
  delete?: TerminalResult;
};

export type FakeSupabaseSeed = {
  /** Drives `auth.getUser()`; `null` simulates an unauthenticated request. */
  user?: { id: string } | null;
  authError?: unknown;
  /** Terminal results per table, keyed by operation. */
  tables?: Record<string, TableSeed>;
  /** Terminal results per RPC name (e.g. `get_current_usage_summary`). */
  rpc?: Record<string, TerminalResult>;
};

type Operation = 'select' | 'insert' | 'update' | 'delete';

export type RecordedCalls = {
  rpc: { name: string; params?: unknown }[];
  inserts: { table: string; payload: unknown }[];
  updates: { table: string; payload: unknown }[];
  selects: { table: string }[];
  deletes: { table: string }[];
};

const EMPTY: TerminalResult = { data: null, error: null };

/**
 * A thenable query builder. Chaining methods return `this`; terminal accessors
 * (`single`/`maybeSingle`) and direct `await` both resolve to the seeded
 * `{ data, error }` for the current `(table, operation)`.
 */
class FakeQueryBuilder implements PromiseLike<TerminalResult> {
  private operation: Operation = 'select';

  constructor(
    private readonly table: string,
    private readonly seed: TableSeed,
    private readonly calls: RecordedCalls,
  ) {}

  select(_columns?: string): this {
    // `.select()` after insert/update keeps the prior operation (write-then-read);
    // a bare read chain stays 'select'.
    if (this.operation === 'select') {
      this.calls.selects.push({ table: this.table });
    }
    return this;
  }

  insert(payload: unknown): this {
    this.operation = 'insert';
    this.calls.inserts.push({ table: this.table, payload });
    return this;
  }

  update(payload: unknown): this {
    this.operation = 'update';
    this.calls.updates.push({ table: this.table, payload });
    return this;
  }

  delete(): this {
    this.operation = 'delete';
    this.calls.deletes.push({ table: this.table });
    return this;
  }

  eq(_column: string, _value: unknown): this {
    return this;
  }

  neq(_column: string, _value: unknown): this {
    return this;
  }

  is(_column: string, _value: unknown): this {
    return this;
  }

  in(_column: string, _values: unknown[]): this {
    return this;
  }

  order(_column: string, _opts?: unknown): this {
    return this;
  }

  limit(_count: number): this {
    return this;
  }

  private resolve(): TerminalResult {
    return this.seed[this.operation] ?? EMPTY;
  }

  maybeSingle(): Promise<TerminalResult> {
    return Promise.resolve(this.resolve());
  }

  single(): Promise<TerminalResult> {
    return Promise.resolve(this.resolve());
  }

  then<TResult1 = TerminalResult, TResult2 = never>(
    onfulfilled?:
      | ((value: TerminalResult) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.resolve()).then(onfulfilled, onrejected);
  }
}

class FakeRpcBuilder implements PromiseLike<TerminalResult> {
  constructor(private readonly result: TerminalResult) {}

  maybeSingle(): Promise<TerminalResult> {
    return Promise.resolve(this.result);
  }

  single(): Promise<TerminalResult> {
    return Promise.resolve(this.result);
  }

  then<TResult1 = TerminalResult, TResult2 = never>(
    onfulfilled?:
      | ((value: TerminalResult) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.result).then(onfulfilled, onrejected);
  }
}

export type FakeSupabase = {
  client: SupabaseClient;
  calls: RecordedCalls;
};

export function createFakeSupabase(seed: FakeSupabaseSeed = {}): FakeSupabase {
  const calls: RecordedCalls = {
    rpc: [],
    inserts: [],
    updates: [],
    selects: [],
    deletes: [],
  };

  const client = {
    auth: {
      getUser() {
        return Promise.resolve({
          data: { user: seed.user ?? null },
          error: seed.authError ?? null,
        });
      },
    },
    from(table: string) {
      return new FakeQueryBuilder(table, seed.tables?.[table] ?? {}, calls);
    },
    rpc(name: string, params?: unknown) {
      calls.rpc.push({ name, params });
      return new FakeRpcBuilder(seed.rpc?.[name] ?? EMPTY);
    },
  };

  return { client: client as unknown as SupabaseClient, calls };
}

/** Row shape returned by the `get_current_usage_summary` RPC. */
export function freeUserSummaryRow(
  overrides: { generation_count?: number; check_count?: number } = {},
): Record<string, unknown> {
  return {
    plan_tier: 'FREE',
    period_start: '2026-06-01T00:00:00.000Z',
    period_end: '2026-07-01T00:00:00.000Z',
    generation_count: overrides.generation_count ?? 0,
    check_count: overrides.check_count ?? 0,
  };
}

export function proUserSummaryRow(
  overrides: { generation_count?: number; check_count?: number } = {},
): Record<string, unknown> {
  return {
    plan_tier: 'PRO',
    period_start: '2026-06-01T00:00:00.000Z',
    period_end: '2026-07-01T00:00:00.000Z',
    generation_count: overrides.generation_count ?? 0,
    check_count: overrides.check_count ?? 0,
  };
}
