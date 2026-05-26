import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ThemeProvider, useTheme } from "next-themes";
import { supabase } from "@/lib/supabase";
import {
  ACCENT_PRESETS,
  ACCENT_STORAGE_KEY,
  COMPACT_LAYOUT_STORAGE_KEY,
  REDUCE_MOTION_STORAGE_KEY,
  THEME_STORAGE_KEY,
  isAccentPreset,
  isAppearanceTheme,
  type AccentPreset,
  type AppearanceTheme,
} from "@/lib/appearance";

type AppearanceContextValue = {
  theme: AppearanceTheme;
  setTheme: (theme: AppearanceTheme) => void;
  accentPreset: AccentPreset;
  setAccentPreset: (accent: AccentPreset) => void;
  reduceMotion: boolean;
  setReduceMotion: (value: boolean) => void;
  compactLayout: boolean;
  setCompactLayout: (value: boolean) => void;
};

const AppearanceContext = createContext<AppearanceContextValue | undefined>(undefined);

function readStoredBoolean(key: string, fallback: boolean) {
  if (typeof window === "undefined") return fallback;
  const value = window.localStorage.getItem(key);
  return value === null ? fallback : value === "true";
}

function AppearanceProviderInner({ children }: { children: ReactNode }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [accentPreset, setAccentPresetState] = useState<AccentPreset>(() => {
    if (typeof window === "undefined") return "purple";
    const stored = window.localStorage.getItem(ACCENT_STORAGE_KEY);
    return isAccentPreset(stored) ? stored : "purple";
  });
  const [reduceMotion, setReduceMotionState] = useState<boolean>(() =>
    readStoredBoolean(REDUCE_MOTION_STORAGE_KEY, false),
  );
  const [compactLayout, setCompactLayoutState] = useState<boolean>(() =>
    readStoredBoolean(COMPACT_LAYOUT_STORAGE_KEY, false),
  );
  const [userId, setUserId] = useState<string | null>(null);
  const dbSyncDisabledRef = useRef(false);

  const theme: AppearanceTheme = resolvedTheme === "light" ? "light" : "dark";

  useEffect(() => {
    const root = document.documentElement;
    const tokens = ACCENT_PRESETS[accentPreset].tokens;

    root.style.setProperty("--accent", tokens.accent);
    root.style.setProperty("--accent-foreground", tokens.accentForeground);
    root.style.setProperty("--primary", tokens.primary);
    root.style.setProperty("--primary-foreground", tokens.primaryForeground);
    root.style.setProperty("--primary-glow", tokens.primaryGlow);
    root.style.setProperty("--chart-1", tokens.chart1);
    root.style.setProperty("--ring", tokens.primary);
    root.style.setProperty("--sidebar-primary", tokens.sidebarPrimary);
    root.style.setProperty("--sidebar-primary-foreground", tokens.sidebarPrimaryForeground);
  }, [accentPreset]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.reduceMotion = reduceMotion ? "true" : "false";
    root.dataset.compactLayout = compactLayout ? "true" : "false";
  }, [compactLayout, reduceMotion]);

  useEffect(() => {
    window.localStorage.setItem(ACCENT_STORAGE_KEY, accentPreset);
  }, [accentPreset]);

  useEffect(() => {
    window.localStorage.setItem(REDUCE_MOTION_STORAGE_KEY, String(reduceMotion));
  }, [reduceMotion]);

  useEffect(() => {
    window.localStorage.setItem(COMPACT_LAYOUT_STORAGE_KEY, String(compactLayout));
  }, [compactLayout]);

  useEffect(() => {
    let mounted = true;

    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (mounted) {
        setUserId(data.user?.id ?? null);
      }
    };

    void loadUser();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    const loadAppearance = async () => {
      const { data, error } = await supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (cancelled || error || !data) return;

      const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
      const storedAccent = window.localStorage.getItem(ACCENT_STORAGE_KEY);
      const storedReduceMotion = window.localStorage.getItem(REDUCE_MOTION_STORAGE_KEY);
      const storedCompactLayout = window.localStorage.getItem(COMPACT_LAYOUT_STORAGE_KEY);

      if (!storedTheme && isAppearanceTheme(data.theme)) {
        setTheme(data.theme);
      }

      if (!storedAccent && isAccentPreset(data.accent_color)) {
        setAccentPresetState(data.accent_color);
      }

      if (storedReduceMotion === null && typeof data.reduce_motion === "boolean") {
        setReduceMotionState(data.reduce_motion);
      }

      if (storedCompactLayout === null && typeof data.compact_layout === "boolean") {
        setCompactLayoutState(data.compact_layout);
      }
    };

    void loadAppearance();

    return () => {
      cancelled = true;
    };
  }, [setTheme, userId]);

  useEffect(() => {
    if (!userId || dbSyncDisabledRef.current) return;

    const syncAppearance = async () => {
      const { error } = await supabase.from("user_preferences").upsert(
        {
          user_id: userId,
          theme,
          accent_color: accentPreset,
          reduce_motion: reduceMotion,
          compact_layout: compactLayout,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

      if (error) {
        const message = error.message.toLowerCase();
        if (
          message.includes("theme")
          || message.includes("accent_color")
          || message.includes("reduce_motion")
          || message.includes("compact_layout")
        ) {
          dbSyncDisabledRef.current = true;
          return;
        }

        console.error("[appearance] Failed to sync appearance preferences:", error);
      }
    };

    void syncAppearance();
  }, [accentPreset, compactLayout, reduceMotion, theme, userId]);

  const value = useMemo<AppearanceContextValue>(
    () => ({
      theme,
      setTheme: (nextTheme) => setTheme(nextTheme),
      accentPreset,
      setAccentPreset: setAccentPresetState,
      reduceMotion,
      setReduceMotion: setReduceMotionState,
      compactLayout,
      setCompactLayout: setCompactLayoutState,
    }),
    [accentPreset, compactLayout, reduceMotion, setTheme, theme],
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function AppAppearanceProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      storageKey={THEME_STORAGE_KEY}
    >
      <AppearanceProviderInner>{children}</AppearanceProviderInner>
    </ThemeProvider>
  );
}

export function useAppearance() {
  const context = useContext(AppearanceContext);
  if (!context) {
    throw new Error("useAppearance must be used inside <AppAppearanceProvider>");
  }
  return context;
}
