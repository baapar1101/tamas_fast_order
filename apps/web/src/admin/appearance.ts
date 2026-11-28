import { useEffect, useState, useSyncExternalStore } from 'react';

/**
 * Per-browser look of the admin panel: theme, density, skin and the glass
 * controls. Same model and scale as the MARK workspace (docs/ui-guidelines.md §12).
 * Every change is saved at once; nothing here touches the server.
 */
export type AdminThemePref = 'light' | 'dark' | 'system';
export type AdminDensity = 'normal' | 'compact';
export type AdminSkin = 'glass' | 'plain';

export interface AdminAppearance {
  theme: AdminThemePref;
  density: AdminDensity;
  skin: AdminSkin;
  /** Glass frost level, 1–10 (blur behind panes). */
  frost: number;
  /** Glass tint level, 1–10 (how opaque panes are). */
  tint: number;
  /** Refractive lens edge on widgets (Chromium only). */
  bend: boolean;
}

/** Blur behind glass panes for frost levels 1–10, in px. */
export const FROST_BLUR_PX = [0.5, 1.5, 3, 5, 7.5, 10, 14, 18, 23, 30] as const;
/** Pane opacity for tint levels 1–10. */
export const TINT_ALPHA = [0.08, 0.16, 0.26, 0.36, 0.46, 0.56, 0.66, 0.76, 0.86, 0.95] as const;
export const GLASS_LEVELS = FROST_BLUR_PX.length;

export const DEFAULT_APPEARANCE: AdminAppearance = {
  theme: 'dark',
  density: 'normal',
  skin: 'glass',
  frost: 3,
  tint: 2,
  bend: true,
};

const STORAGE_KEY = 'tamas_admin_appearance';
/** Older single-purpose key; still written because the app shell reads it while loading. */
const LEGACY_THEME_KEY = 'tamas_admin_theme';

function level(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= GLASS_LEVELS ? n : fallback;
}

function normalize(raw: Partial<AdminAppearance> | null | undefined, legacyTheme?: string | null): AdminAppearance {
  const value = raw ?? {};
  const fallbackTheme: AdminThemePref = legacyTheme === 'light' ? 'light' : DEFAULT_APPEARANCE.theme;
  return {
    theme: value.theme === 'light' || value.theme === 'dark' || value.theme === 'system' ? value.theme : fallbackTheme,
    density: value.density === 'compact' ? 'compact' : 'normal',
    skin: value.skin === 'plain' ? 'plain' : 'glass',
    frost: level(value.frost, DEFAULT_APPEARANCE.frost),
    tint: level(value.tint, DEFAULT_APPEARANCE.tint),
    bend: typeof value.bend === 'boolean' ? value.bend : DEFAULT_APPEARANCE.bend,
  };
}

function read(): AdminAppearance {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return normalize(raw ? JSON.parse(raw) : null, localStorage.getItem(LEGACY_THEME_KEY));
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

let current: AdminAppearance | null = null;
const listeners = new Set<() => void>();

function snapshot(): AdminAppearance {
  current ??= read();
  return current;
}

export function setAdminAppearance(patch: Partial<AdminAppearance>) {
  current = normalize({ ...snapshot(), ...patch });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {}
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAdminAppearance(): AdminAppearance {
  return useSyncExternalStore(subscribe, snapshot, () => DEFAULT_APPEARANCE);
}

/** The theme actually shown: «system» follows the device and updates live. */
export function useResolvedTheme(pref: AdminThemePref): 'light' | 'dark' {
  const query = '(prefers-color-scheme: light)';
  const [systemLight, setSystemLight] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(query).matches);
  useEffect(() => {
    const media = window.matchMedia?.(query);
    if (!media) return;
    const onChange = () => setSystemLight(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  if (pref === 'system') return systemLight ? 'light' : 'dark';
  return pref;
}

/**
 * Mirrors the appearance onto <body> while the admin is mounted: theme class,
 * data-skin / data-bend / data-density, and the glass variables the CSS reads.
 */
export function useApplyAppearance(appearance: AdminAppearance, theme: 'light' | 'dark') {
  useEffect(() => {
    const body = document.body;
    body.classList.toggle('admin-theme-light', theme === 'light');
    try {
      localStorage.setItem(LEGACY_THEME_KEY, theme);
    } catch {}
    return () => body.classList.remove('admin-theme-light');
  }, [theme]);

  useEffect(() => {
    const body = document.body;
    const glass = appearance.skin === 'glass';
    body.dataset.skin = appearance.skin;
    body.dataset.density = appearance.density;
    body.dataset.bend = glass && appearance.bend ? 'on' : 'off';
    if (glass) {
      body.style.setProperty('--glass-blur', `${Math.max(FROST_BLUR_PX[appearance.frost - 1]!, 2)}px`);
      body.style.setProperty('--glass-a', String(TINT_ALPHA[appearance.tint - 1]));
    } else {
      body.style.removeProperty('--glass-blur');
      body.style.removeProperty('--glass-a');
    }
    return () => {
      delete body.dataset.skin;
      delete body.dataset.density;
      delete body.dataset.bend;
      body.style.removeProperty('--glass-blur');
      body.style.removeProperty('--glass-a');
    };
  }, [appearance.skin, appearance.density, appearance.bend, appearance.frost, appearance.tint]);
}
