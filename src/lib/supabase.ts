import { createClient } from "@supabase/supabase-js";

/**
 * DashForge — Supabase client.
 */
const SUPABASE_URL = "https://mrccuruzsqqfnezvrbtc.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_1vjHU_2ZDiR2VjkH-dfIdA_hwJbS3L2";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
    storageKey: "dashforge.auth",
  },
});

export const isSupabaseConfigured =
  !SUPABASE_URL.includes("YOUR-PROJECT-REF") &&
  !SUPABASE_ANON_KEY.includes("YOUR-ANON");
