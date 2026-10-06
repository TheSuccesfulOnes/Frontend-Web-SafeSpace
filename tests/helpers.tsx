import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { vi } from "vitest";
import { LanguageProvider } from "../src/i18n/LanguageProvider";
import { translations } from "../src/i18n/translations";
import { unexpectedRequests } from "./setup";
export { screen, fireEvent, waitFor };
export const t = translations.es;
export const token = "test-only-token";
export const auth = {
  token,
  username: "ana",
  display_name: "Ana Lima",
  role: "EMPLOYEE",
  user_id: 1,
};
export const session = {
  token,
  username: "ana",
  displayName: "Ana Lima",
  role: "EMPLOYEE" as const,
  userId: 1,
};
export const profile = {
  ...session,
  email: "ana@example.test",
  language: "es" as const,
  theme: "light" as const,
};
export const apiProfile = {
  ...auth,
  email: profile.email,
  language: "ES",
  theme: "LIGHT",
};
export const survey = {
  id: 1,
  title: "Daily question",
  question: "How are you?",
  type: "DAILY",
  status: "PUBLISHED",
  allow_comments: true,
  answers: 0,
  answered: false,
};
export const activity = {
  id: 2,
  title: "Team activity",
  description: "Choose one",
  status: "OPEN",
  options: [
    { id: 3, label: "Walk", votes: 1, percentage: 50 },
    { id: 4, label: "Read", votes: 1, percentage: 50 },
  ],
};
export const comment = {
  id: 5,
  content: "Root comment",
  likes: 0,
  can_delete: true,
  created_at: "2026-01-01T12:00:00Z",
  replies: [],
};
export const report = {
  id: 6,
  category: "TI",
  title: "Report title",
  description: "Report description",
  priority: "NORMAL",
  status: "NEW",
  anonymous: true,
  reporter_display_name: null,
  created_at: "2026-01-01T12:00:00Z",
};
export function mount(node: ReactNode) {
  return render(node, { wrapper: LanguageProvider });
}
export function change(element: HTMLElement, value: string) {
  fireEvent.change(element, { target: { value } });
}
export function field(key: keyof typeof t) {
  return screen.getByLabelText(t[key]);
}
export function button(key: keyof typeof t) {
  return screen.getByRole("button", { name: t[key] });
}
export function submit(element: HTMLElement) {
  fireEvent.submit(element.closest("form")!);
}
export function response(payload: unknown, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
type Handler = (body: any, init: RequestInit) => unknown | Promise<unknown>;
export function network(routes: Record<string, unknown | Handler>) {
  const calls: {
    path: string;
    method: string;
    body: any;
    headers: Record<string, string>;
  }[] = [];
  const fetch = vi.fn(
    async (url: string | URL | Request, init: RequestInit = {}) => {
      const path = new URL(String(url), "http://test.invalid").pathname;
      const method = init.method ?? "GET";
      const body = init.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({
        path,
        method,
        body,
        headers: init.headers as Record<string, string>,
      });
      const key = `${method} ${path}`;
      if (!(key in routes)) {
        unexpectedRequests.push(key);
        throw new Error(`Unmocked request ${key}`);
      }
      const handler = routes[key];
      const result =
        typeof handler === "function" ? await handler(body, init) : handler;
      return result instanceof Response ? result : response(result);
    },
  );
  vi.stubGlobal("fetch", fetch);
  return {
    fetch,
    calls,
    mutations: () => calls.filter((c) => c.method !== "GET"),
  };
}
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
