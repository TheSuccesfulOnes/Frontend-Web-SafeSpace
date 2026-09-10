import type { Language, Profile, Theme } from "../../domain/types";
import { apiRequest } from "../api/apiClient";

type ApiProfile = Omit<
  Profile,
  "displayName" | "userId" | "language" | "theme"
> & {
  display_name: string;
  user_id: number;
  language: string;
  theme: string;
};

function mapProfile(profile: ApiProfile): Profile {
  return {
    ...profile,
    displayName: profile.display_name,
    userId: profile.user_id,
    language: profile.language.toLowerCase() === "en" ? "en" : "es",
    theme: profile.theme.toLowerCase() === "dark" ? "dark" : "light",
  };
}

export async function getProfile(token: string): Promise<Profile> {
  return mapProfile(await apiRequest<ApiProfile>("/api/v1/profile", { token }));
}

export async function updateAccount(
  token: string,
  input: { username: string; email: string; displayName: string },
): Promise<{ profile: Profile; token: string }> {
  const response = await apiRequest<{ profile: ApiProfile; token: string }>(
    "/api/v1/profile/account",
    {
      method: "PUT",
      token,
      body: JSON.stringify({
        username: input.username.trim(),
        email: input.email.trim() || null,
        display_name: input.displayName.trim(),
      }),
    },
  );
  return { profile: mapProfile(response.profile), token: response.token };
}

export async function updatePreferences(
  token: string,
  language: Language,
  theme: Theme,
): Promise<Profile> {
  return mapProfile(
    await apiRequest<ApiProfile>("/api/v1/profile/preferences", {
      method: "PUT",
      token,
      body: JSON.stringify({ language, theme }),
    }),
  );
}
