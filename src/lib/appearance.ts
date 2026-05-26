export const THEME_STORAGE_KEY = "dash-nexus.theme";
export const ACCENT_STORAGE_KEY = "dash-nexus.accent";
export const REDUCE_MOTION_STORAGE_KEY = "dash-nexus.reduce-motion";
export const COMPACT_LAYOUT_STORAGE_KEY = "dash-nexus.compact-layout";

export const THEME_VALUES = ["dark", "light"] as const;
export const ACCENT_VALUES = ["purple", "blue", "green", "orange", "red", "pink", "slate"] as const;

export type AppearanceTheme = (typeof THEME_VALUES)[number];
export type AccentPreset = (typeof ACCENT_VALUES)[number];

type AccentTokens = {
  accent: string;
  accentForeground: string;
  primary: string;
  primaryForeground: string;
  primaryGlow: string;
  chart1: string;
  sidebarPrimary: string;
  sidebarPrimaryForeground: string;
};

export const ACCENT_PRESETS: Record<
  AccentPreset,
  {
    label: string;
    swatch: string;
    tokens: AccentTokens;
  }
> = {
  purple: {
    label: "Purple",
    swatch: "hsl(243 75% 59%)",
    tokens: {
      accent: "243 75% 59%",
      accentForeground: "220 20% 98%",
      primary: "243 75% 59%",
      primaryForeground: "220 20% 98%",
      primaryGlow: "265 80% 65%",
      chart1: "243 75% 59%",
      sidebarPrimary: "243 75% 59%",
      sidebarPrimaryForeground: "220 20% 98%",
    },
  },
  blue: {
    label: "Blue",
    swatch: "hsl(212 92% 58%)",
    tokens: {
      accent: "212 92% 58%",
      accentForeground: "0 0% 100%",
      primary: "212 92% 58%",
      primaryForeground: "0 0% 100%",
      primaryGlow: "199 95% 68%",
      chart1: "212 92% 58%",
      sidebarPrimary: "212 92% 58%",
      sidebarPrimaryForeground: "0 0% 100%",
    },
  },
  green: {
    label: "Green",
    swatch: "hsl(152 65% 45%)",
    tokens: {
      accent: "152 65% 45%",
      accentForeground: "0 0% 100%",
      primary: "152 65% 45%",
      primaryForeground: "0 0% 100%",
      primaryGlow: "160 64% 58%",
      chart1: "152 65% 45%",
      sidebarPrimary: "152 65% 45%",
      sidebarPrimaryForeground: "0 0% 100%",
    },
  },
  orange: {
    label: "Orange",
    swatch: "hsl(28 92% 55%)",
    tokens: {
      accent: "28 92% 55%",
      accentForeground: "0 0% 100%",
      primary: "28 92% 55%",
      primaryForeground: "0 0% 100%",
      primaryGlow: "38 96% 64%",
      chart1: "28 92% 55%",
      sidebarPrimary: "28 92% 55%",
      sidebarPrimaryForeground: "0 0% 100%",
    },
  },
  red: {
    label: "Red",
    swatch: "hsl(0 78% 58%)",
    tokens: {
      accent: "0 78% 58%",
      accentForeground: "0 0% 100%",
      primary: "0 78% 58%",
      primaryForeground: "0 0% 100%",
      primaryGlow: "8 90% 68%",
      chart1: "0 78% 58%",
      sidebarPrimary: "0 78% 58%",
      sidebarPrimaryForeground: "0 0% 100%",
    },
  },
  pink: {
    label: "Pink",
    swatch: "hsl(330 78% 60%)",
    tokens: {
      accent: "330 78% 60%",
      accentForeground: "0 0% 100%",
      primary: "330 78% 60%",
      primaryForeground: "0 0% 100%",
      primaryGlow: "318 88% 70%",
      chart1: "330 78% 60%",
      sidebarPrimary: "330 78% 60%",
      sidebarPrimaryForeground: "0 0% 100%",
    },
  },
  slate: {
    label: "Slate",
    swatch: "hsl(215 16% 47%)",
    tokens: {
      accent: "215 16% 47%",
      accentForeground: "0 0% 100%",
      primary: "215 16% 47%",
      primaryForeground: "0 0% 100%",
      primaryGlow: "215 20% 62%",
      chart1: "215 16% 47%",
      sidebarPrimary: "215 16% 47%",
      sidebarPrimaryForeground: "0 0% 100%",
    },
  },
};

export function isAppearanceTheme(value: string | null | undefined): value is AppearanceTheme {
  return !!value && THEME_VALUES.includes(value as AppearanceTheme);
}

export function isAccentPreset(value: string | null | undefined): value is AccentPreset {
  return !!value && ACCENT_VALUES.includes(value as AccentPreset);
}
