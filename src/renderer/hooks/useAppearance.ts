import { useSyncExternalStore } from 'react';

export interface AppearanceSettings {
  /** Root font size in px. Everything sized in rem scales with it. */
  textSize: number;
  /** Tighter vertical padding in data tables. */
  compactTables: boolean;
  /** Disable transitions/animations across the app. */
  reduceMotion: boolean;
}

export const TEXT_SIZE_MIN = 14;
export const TEXT_SIZE_MAX = 20;

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  textSize: 16,
  compactTables: false,
  reduceMotion: false,
};

const STORAGE_KEY = 'xenocare.appearance.v1';
const listeners = new Set<() => void>();

function sanitize(value: unknown): AppearanceSettings {
  const input =
    value && typeof value === 'object'
      ? (value as Partial<AppearanceSettings>)
      : {};
  const size = Number(input.textSize);
  return {
    textSize: Number.isFinite(size)
      ? Math.min(TEXT_SIZE_MAX, Math.max(TEXT_SIZE_MIN, Math.round(size)))
      : DEFAULT_APPEARANCE.textSize,
    compactTables: Boolean(input.compactTables),
    reduceMotion: Boolean(input.reduceMotion),
  };
}

function read(): AppearanceSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? sanitize(JSON.parse(raw)) : { ...DEFAULT_APPEARANCE };
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
}

let current = read();

function apply(settings: AppearanceSettings): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.fontSize = `${settings.textSize}px`;
  root.classList.toggle('ui-compact', settings.compactTables);
  root.classList.toggle('ui-reduce-motion', settings.reduceMotion);
}

function commit(next: AppearanceSettings): void {
  current = next;
  apply(current);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    /* storage can be unavailable; settings still apply for this session */
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Apply the saved appearance before the first React render. */
export function applyStoredAppearance(): void {
  apply(current);
}

export function useAppearance() {
  const settings = useSyncExternalStore(
    subscribe,
    () => current,
    () => current,
  );

  return {
    ...settings,
    setTextSize: (textSize: number) =>
      commit({ ...current, textSize: sanitize({ ...current, textSize }).textSize }),
    setCompactTables: (compactTables: boolean) =>
      commit({ ...current, compactTables }),
    setReduceMotion: (reduceMotion: boolean) =>
      commit({ ...current, reduceMotion }),
    resetAppearance: () => commit({ ...DEFAULT_APPEARANCE }),
  };
}
