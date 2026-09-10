import { useEffect, useState } from "react";
import type { Language, Profile, Theme } from "../../../domain/types";
import { useLanguage } from "../../../i18n/LanguageProvider";
import { isUnauthorized } from "../../../infrastructure/api/apiClient";
import { updateAccount } from "../../../infrastructure/profile/profileService";
import { Spinner } from "../../../shared/ui/Spinner";
import { SuccessMessage } from "../../../shared/ui/SuccessMessage";

export function SettingsPage({
  token,
  profile,
  onProfileUpdated,
  onPreferencesUpdated,
  onUnauthorized,
}: {
  token: string;
  profile: Profile;
  onProfileUpdated: (profile: Profile, token?: string) => void;
  onPreferencesUpdated: (language: Language, theme: Theme) => Promise<void>;
  onUnauthorized: () => void;
}) {
  const { t, language } = useLanguage();
  const [form, setForm] = useState({
    username: profile.username,
    email: profile.email ?? "",
    displayName: profile.displayName,
  });
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(
    profile.language ?? language,
  );
  const [selectedTheme, setSelectedTheme] = useState<Theme>(
    profile.theme ?? "light",
  );
  const [pending, setPending] = useState<"account" | "preferences" | null>(
    null,
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setForm({
      username: profile.username,
      email: profile.email ?? "",
      displayName: profile.displayName,
    });
    setSelectedLanguage(profile.language);
    setSelectedTheme(profile.theme);
  }, [profile]);

  async function saveAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending("account");
    setMessage("");
    setError("");
    try {
      const response = await updateAccount(token, form);
      onProfileUpdated(response.profile, response.token);
      setMessage(t("accountUpdated"));
    } catch (errorValue) {
      if (isUnauthorized(errorValue)) onUnauthorized();
      else
        setError(
          errorValue instanceof Error ? errorValue.message : t("errorGeneric"),
        );
    } finally {
      setPending(null);
    }
  }

  async function savePreferences() {
    setPending("preferences");
    setMessage("");
    setError("");
    try {
      await onPreferencesUpdated(selectedLanguage, selectedTheme);
      setMessage(t("preferencesUpdated"));
    } catch (errorValue) {
      if (isUnauthorized(errorValue)) onUnauthorized();
      else
        setError(
          errorValue instanceof Error ? errorValue.message : t("errorGeneric"),
        );
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="content-stack settings-page">
      <div className="page-intro settings-intro">
        <div>
          <span className="eyebrow">{t("personalSpace")}</span>
          <h2>{t("settings")}</h2>
          <p>{t("settingsIntro")}</p>
        </div>
      </div>
      <SuccessMessage message={message} onDismiss={() => setMessage("")} />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="settings-page-content">
        <section
          className="settings-section"
          aria-labelledby="account-settings-title"
        >
          <div className="section-heading settings-section-heading">
            <div>
              <span className="eyebrow">{t("account").toUpperCase()}</span>
              <h3 id="account-settings-title">{t("account")}</h3>
            </div>
          </div>
          <form
            className="stack-form"
            onSubmit={saveAccount}
            aria-busy={pending === "account"}
          >
            <label>
              {t("changeDisplayName")}
              <input
                value={form.displayName}
                onChange={(event) =>
                  setForm({ ...form, displayName: event.target.value })
                }
                required
                maxLength={100}
                autoComplete="name"
              />
            </label>
            <label>
              {t("changeUsername")}
              <input
                value={form.username}
                onChange={(event) =>
                  setForm({ ...form, username: event.target.value })
                }
                required
                maxLength={50}
                autoComplete="username"
              />
            </label>
            <label>
              {t("changeEmail")}
              <input
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm({ ...form, email: event.target.value })
                }
                autoComplete="email"
              />
            </label>
            <button
              type="submit"
              className="primary-button"
              disabled={pending !== null}
            >
              {pending === "account" ? <Spinner /> : t("saveChanges")}{" "}
              <span aria-hidden="true">→</span>
            </button>
          </form>
        </section>
        <section
          className="settings-section"
          aria-labelledby="preferences-settings-title"
        >
          <div className="section-heading settings-section-heading">
            <div>
              <span className="eyebrow">{t("preferences").toUpperCase()}</span>
              <h3 id="preferences-settings-title">{t("preferences")}</h3>
            </div>
          </div>
          <div className="setting-row">
            <div>
              <strong>{t("language")}</strong>
              <span>
                {selectedLanguage === "es" ? t("spanish") : t("english")}
              </span>
            </div>
            <select
              className="settings-select"
              value={selectedLanguage}
              onChange={(event) =>
                setSelectedLanguage(event.target.value as Language)
              }
              aria-label={t("language")}
            >
              <option value="es">{t("spanish")}</option>
              <option value="en">{t("english")}</option>
            </select>
          </div>
          <div className="setting-row">
            <div>
              <strong>{t("theme")}</strong>
              <span>{t("themeDescription")}</span>
            </div>
            <button
              type="button"
              className={
                "theme-toggle " + (selectedTheme === "dark" ? "on" : "")
              }
              aria-pressed={selectedTheme === "dark"}
              aria-label={t("theme")}
              onClick={() =>
                setSelectedTheme((value) =>
                  value === "dark" ? "light" : "dark",
                )
              }
            >
              <span />
            </button>
          </div>
          <button
            type="button"
            className="secondary-button"
            onClick={() => void savePreferences()}
            disabled={pending !== null}
          >
            {pending === "preferences" ? <Spinner /> : t("saveChanges")}
          </button>
        </section>
      </div>
    </section>
  );
}
