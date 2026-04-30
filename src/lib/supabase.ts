import { createClient } from "@supabase/supabase-js";

/**
 * DashForge — Supabase client.
 *
 * 👉 Paste your project's URL and ANON (publishable) key below.
 *    Both values are safe to ship in client code; RLS protects your data.
 *    Find them in: Supabase dashboard → Project Settings → API.
 */
const SUPABASE_URL = "https://YOUR-PROJECT-REF.supabase.co";
const SUPABASE_ANON_KEY = "YOUR-ANON-PUBLIC-KEY";

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
