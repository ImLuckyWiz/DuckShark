import { DEFAULT_SETTINGS, STORAGE_KEY, type TDuckSettings } from "./constants";

const load = (): TDuckSettings => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<TDuckSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

let state: TDuckSettings = load();
const listeners = new Set<() => void>();

const commit = (next: TDuckSettings) => {
  state = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked
  }
  listeners.forEach((listener) => listener());
};

export const getSettings = (): TDuckSettings => state;

export const setSettings = (updates: Partial<TDuckSettings>) => {
  commit({ ...state, ...updates });
};

export const resetSettings = () => {
  commit({ ...DEFAULT_SETTINGS });
};

export const subscribeSettings = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

// Keep open tabs in sync
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    state = load();
    listeners.forEach((listener) => listener());
  });
}
