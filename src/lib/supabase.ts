import { createClient } from "@supabase/supabase-js";

/**
 * DashForge — Supabase client.
 *
 * This file implements a small, defensive storage adapter for Supabase's
 * auth persistence. Stale or malformed stored sessions (missing a refresh
 * token) can cause repeated 400 errors from `/auth/v1/token` and lead to
 * infinite refresh loops. The adapter removes invalid stored values and
 * exposes a helper to clear them manually.
 */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const STORAGE_KEY = "dashforge.auth";

function hasRefreshToken(obj: any): boolean {
  if (!obj || typeof obj !== "object") return false;
  if (Object.prototype.hasOwnProperty.call(obj, "refresh_token") && obj.refresh_token) return true;
  for (const k of Object.keys(obj)) {
    try {
      if (hasRefreshToken(obj[k])) return true;
    } catch (e) {
      // ignore
    }
  }
  return false;
}

function isValidSessionString(value: string | null) {
  if (!value) return false;
  try {
    const parsed = JSON.parse(value);
    return hasRefreshToken(parsed) || hasRefreshToken(parsed?.currentSession) || Boolean(parsed?.access_token);
  } catch (e) {
    return false;
  }
}

const storageAdapter = typeof window !== "undefined" && window?.localStorage
  ? {
      getItem: (key: string) => {
        try {
          const raw = window.localStorage.getItem(key);
          // If stored value is malformed or missing tokens, remove it and
          // return null so Supabase doesn't try a bad refresh request.
          if (!isValidSessionString(raw)) {
            if (raw !== null) {
              console.debug("[supabase] removing invalid stored session", key);
              window.localStorage.removeItem(key);
            }
            return null;
          }
          return raw;
        } catch (e) {
          console.debug("[supabase] storage.getItem error", e);
          return null;
        }
      },
      setItem: (key: string, value: string) => {
        try {
          window.localStorage.setItem(key, value);
        } catch (e) {
          console.debug("[supabase] storage.setItem error", e);
        }
      },
      removeItem: (key: string) => {
        try {
          window.localStorage.removeItem(key);
        } catch (e) {
          console.debug("[supabase] storage.removeItem error", e);
        }
      },
    }
  : undefined;

// Create the client using the defensive storage adapter and explicit options.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: storageAdapter,
    storageKey: STORAGE_KEY,
  },
});

export const isSupabaseConfigured =
  Boolean(SUPABASE_URL) &&
  Boolean(SUPABASE_ANON_KEY) &&
  !String(SUPABASE_URL).includes("YOUR-PROJECT-REF") &&
  !String(SUPABASE_ANON_KEY).includes("YOUR-ANON");

/**
 * Helper to remove any invalid stored sessions created by previous runs or
 * other SDK versions. Safe to call from UI code (no-op on server).
 */
export function clearInvalidStoredSession() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!isValidSessionString(raw) && raw !== null) {
      console.debug("[supabase] clearing invalid session from localStorage", STORAGE_KEY);
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch (e) {
    console.debug("[supabase] clearInvalidStoredSession error", e);
  }
}
