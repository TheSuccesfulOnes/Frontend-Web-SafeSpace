import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, expect, vi } from "vitest";
export const unexpectedRequests: string[] = [];
beforeEach(() => {
  unexpectedRequests.length = 0;
  vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.lang = "es";
  sessionStorage.clear();
  localStorage.clear();
  window.location.hash = "";
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      unexpectedRequests.push("missing fetch fixture");
      throw new Error("Unexpected network call: supply an in-memory handler");
    }),
  );
  HTMLElement.prototype.scrollTo = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  expect(
    unexpectedRequests,
    "Unmocked fetch calls must fail even if a component catches the error",
  ).toEqual([]);
});
