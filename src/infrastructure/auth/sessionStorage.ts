import type { AuthSession } from "../../domain/types";

const SESSION_KEY = "safespace.web.session";

export function readSession(): AuthSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    const session = value as Partial<AuthSession>;
    if (
      typeof session.token !== "string" ||
      !session.token.trim() ||
      typeof session.username !== "string" ||
      !session.username.trim() ||
      typeof session.displayName !== "string" ||
      !session.displayName.trim() ||
      !["EMPLOYEE", "HR_MEMBER", "SYSTEM_ADMIN"].includes(session.role ?? "") ||
      !Number.isSafeInteger(session.userId) ||
      (session.userId ?? 0) <= 0
    ) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session as AuthSession;
  } catch {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // Storage can be unavailable entirely; still fail closed.
    }
    return null;
  }
}

export function saveSession(session: AuthSession): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}
