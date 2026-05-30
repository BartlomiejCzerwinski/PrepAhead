/// <reference types="astro/client" />

import type { User } from '@supabase/supabase-js';

declare global {
  namespace App {
    interface Locals {
      user: User | null;
    }
  }
}

export {};
