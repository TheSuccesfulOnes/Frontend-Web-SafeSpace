import type { AuthSession, Role } from "../../domain/types";
import { apiRequest } from "../api/apiClient";

type ApiAuthResponse = {
  token: string;
  username: string;
  display_name: string;
  role: Role;
  user_id: number;
};

function mapAuth(response: ApiAuthResponse): AuthSession {
  return {
    token: response.token,
    username: response.username,
    displayName: response.display_name,
    role: response.role,
    userId: response.user_id,
  };
}

export async function login(
  identifier: string,
  password: string,
): Promise<AuthSession> {
  const response = await apiRequest<ApiAuthResponse>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ identifier: identifier.trim(), password }),
  });
  return mapAuth(response);
}

export async function register(input: {
  displayName: string;
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}): Promise<AuthSession> {
  const response = await apiRequest<ApiAuthResponse>("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify({
      display_name: input.displayName.trim(),
      username: input.username.trim(),
      email: input.email.trim(),
      password: input.password,
      confirm_password: input.confirmPassword,
    }),
  });
  return mapAuth(response);
}

export async function requestPasswordRecovery(
  identifier: string,
): Promise<string> {
  const response = await apiRequest<{ message: string }>(
    "/api/v1/auth/password-recovery/request",
    {
      method: "POST",
      body: JSON.stringify({ identifier: identifier.trim() }),
    },
  );
  return response.message;
}
