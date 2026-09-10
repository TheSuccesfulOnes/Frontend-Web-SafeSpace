import { API_URL } from "../config/env";

type ApiErrorPayload = {
  code?: unknown;
  message?: unknown;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

type RequestOptions = Omit<RequestInit, "headers"> & {
  token?: string;
  headers?: Record<string, string>;
};

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { token, headers, ...init } = options;
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  if (response.status === 204) return undefined as T;

  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const errorPayload = payload as ApiErrorPayload | null;
    const message =
      typeof errorPayload?.message === "string"
        ? errorPayload.message
        : "No se pudo completar la solicitud.";
    const code =
      typeof errorPayload?.code === "string" ? errorPayload.code : undefined;
    throw new ApiError(message, response.status, code);
  }

  return payload as T;
}

export function isUnauthorized(error: unknown): boolean {
  return (
    error instanceof ApiError && (error.status === 401 || error.status === 403)
  );
}
