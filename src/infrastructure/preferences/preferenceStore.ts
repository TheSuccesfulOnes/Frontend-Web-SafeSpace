import type { Language, Theme } from "../../domain/types";

function key(userId: number, suffix: string): string {
  return `safespace.user.${userId}.${suffix}`;
}

export function readLocalPreferences(userId: number): {
  language?: Language;
  theme?: Theme;
} {
  const language = localStorage.getItem(key(userId, "language"));
  const theme = localStorage.getItem(key(userId, "theme"));
  return {
    language: language === "es" || language === "en" ? language : undefined,
    theme: theme === "light" || theme === "dark" ? theme : undefined,
  };
}

export function saveLocalPreference(
  userId: number,
  name: "language" | "theme",
  value: string,
): void {
  localStorage.setItem(key(userId, name), value);
}
