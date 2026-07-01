import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { Session } from '@supabase/supabase-js';
import { combineChunks } from '@supabase/ssr/dist/module/utils/chunker.js';
import { stringFromBase64URL } from '@supabase/ssr/dist/module/utils/base64url.js';

const BASE64_PREFIX = 'base64-';

type StorageStateCookie = {
  name: string;
  value: string;
};

function getStorageKey(supabaseUrl: string): string {
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
  return `sb-${projectRef}-auth-token`;
}

function decodeChunkedCookieValue(value: string): string | null {
  if (!value.startsWith(BASE64_PREFIX)) {
    return value;
  }
  try {
    return stringFromBase64URL(value.substring(BASE64_PREFIX.length));
  } catch {
    return null;
  }
}

export async function sessionFromStorageState(
  supabaseUrl: string,
  storagePath = resolve(process.cwd(), 'e2e/.auth/user.json'),
): Promise<Session | null> {
  let state: { cookies?: StorageStateCookie[] };
  try {
    state = JSON.parse(readFileSync(storagePath, 'utf8')) as {
      cookies?: StorageStateCookie[];
    };
  } catch {
    return null;
  }

  const cookies = state.cookies ?? [];
  if (cookies.length === 0) {
    return null;
  }

  const key = getStorageKey(supabaseUrl);
  const cookieMap = new Map(cookies.map((cookie) => [cookie.name, cookie.value]));

  const combined = await combineChunks(key, async (chunkName) => cookieMap.get(chunkName) ?? null);
  if (!combined) {
    return null;
  }

  const decoded = decodeChunkedCookieValue(combined);
  if (!decoded) {
    return null;
  }

  try {
    return JSON.parse(decoded) as Session;
  } catch {
    return null;
  }
}
