// utils/theme.ts
export type Theme = "light" | "dark";

/**
 * Set theme on documentElement and persist to localStorage.
 * SSR-safe.
 */
export function setTheme(theme: Theme) {
  if (typeof window === "undefined" || !document?.documentElement) return;
  if (theme === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
  try {
    localStorage.setItem("theme", theme);
  } catch {
    // ignore (private mode)
  }
}

/**
 * Read persisted theme (or system fallback).
 */
export function readInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    const stored = localStorage.getItem("theme") as Theme | null;
    if (stored === "dark" || stored === "light") return stored;
  } catch {}
  const systemDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  return systemDark ? "dark" : "light";
}
