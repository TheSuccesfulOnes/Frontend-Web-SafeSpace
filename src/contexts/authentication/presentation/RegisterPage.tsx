import { useState } from "react";
import type { FormEvent } from "react";
import { useLanguage } from "../../../i18n/LanguageProvider";
import { register } from "../../../infrastructure/auth/authService";
import { Spinner } from "../../../shared/ui/Spinner";
import { AuthLayout } from "./AuthLayout";
import { PasswordField } from "../../../shared/ui/PasswordField";
import {
  isRegistrationPasswordValid,
  passwordRequirements,
  passwordWithinLimit,
} from "../domain/passwordPolicy";
import { PRIVACY_POLICY_URL } from "../../../infrastructure/config/legal";
import type { TranslationKey } from "../../../i18n/translations";

export function RegisterPage({
  onBack,
  onRegistered,
}: {
  onBack: () => void;
  onRegistered: () => void;
}) {
  const { t } = useLanguage();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    displayName: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (!form.displayName.trim()) {
      setError(t("errorGeneric"));
      return;
    }
    if (!isRegistrationPasswordValid(form.password)) {
      setError(
        t(
          passwordWithinLimit(form.password)
            ? "passwordRequirementsError"
            : "passwordTooLong",
        ),
      );
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("");
      return;
    }
    setPending(true);
    setError("");
    try {
      await register(form);
      onRegistered();
    } catch (errorValue) {
      const message = errorValue instanceof Error ? errorValue.message : "";
      setError(
        message.includes("special character")
          ? t("passwordRequirementsError")
          : message.includes("Password exceeds")
            ? t("passwordTooLong")
            : message === "Passwords do not match"
              ? t("passwordMismatch")
              : message || t("errorGeneric"),
      );
    } finally {
      setPending(false);
    }
  }

  function update(name: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
    setError("");
  }

  return (
    <AuthLayout>
      <div className="auth-form-card">
        <h2>{t("createAccount")}</h2>
        <p className="form-intro">{t("createAccountIntro")}</p>
        <form className="stack-form" onSubmit={submit}>
          <label>
            {t("displayName")}
            <input
              value={form.displayName}
              onChange={(event) => update("displayName", event.target.value)}
              required
              maxLength={100}
              autoComplete="name"
              placeholder={t("displayNamePlaceholder")}
            />
          </label>
          <label>
            {t("username")}
            <input
              value={form.username}
              onChange={(event) => update("username", event.target.value)}
              required
              maxLength={50}
              autoComplete="username"
              placeholder={t("usernamePlaceholder")}
            />
          </label>
          <label>
            {t("email")}
            <input
              type="email"
              value={form.email}
              onChange={(event) => update("email", event.target.value)}
              required
              autoComplete="email"
              placeholder={t("emailPlaceholder")}
            />
          </label>
          <div className="form-columns">
            <PasswordField
              id="web-register-password"
              label={t("password")}
              value={form.password}
              onChange={(event) => update("password", event.target.value)}
              required
              minLength={8}
              maxLength={72}
              autoComplete="new-password"
              placeholder={t("passwordPlaceholder")}
              aria-describedby={
                form.password.length > 0
                  ? "register-password-requirements"
                  : undefined
              }
            />
            <PasswordField
              id="web-register-confirm-password"
              label={t("confirmPassword")}
              value={form.confirmPassword}
              onChange={(event) =>
                update("confirmPassword", event.target.value)
              }
              required
              minLength={8}
              maxLength={72}
              autoComplete="new-password"
              placeholder={t("confirmPasswordPlaceholder")}
              aria-invalid={Boolean(
                form.confirmPassword && form.password !== form.confirmPassword,
              )}
              aria-describedby={
                form.confirmPassword && form.password !== form.confirmPassword
                  ? "register-password-mismatch"
                  : undefined
              }
            />
          </div>
          {form.password.length > 0 && (
            <div
              id="register-password-requirements"
              className="password-requirements"
            >
              <p>{t("passwordRequirementsTitle")}</p>
              <ul>
                {Object.entries(passwordRequirements(form.password)).map(
                  ([key, met]) => (
                    <li
                      key={key}
                      className={
                        met ? "requirement-met" : "requirement-pending"
                      }
                    >
                      <span
                        className="material-symbols-rounded"
                        aria-hidden="true"
                      >
                        {met ? "check_circle" : "cancel"}
                      </span>
                      <span>{t(key as TranslationKey)}</span>
                      <span className="sr-only">
                        {t(met ? "requirementMet" : "requirementPending")}
                      </span>
                    </li>
                  ),
                )}
              </ul>
              {!passwordWithinLimit(form.password) && (
                <p className="form-error" role="alert">
                  {t("passwordTooLong")}
                </p>
              )}
            </div>
          )}
          {form.confirmPassword && form.password !== form.confirmPassword && (
            <p id="register-password-mismatch" className="form-error">
              {t("passwordMismatch")}
            </p>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary-button" type="submit" disabled={pending}>
            {pending ? (
              <>
                <Spinner /> {t("registering")}
              </>
            ) : (
              t("registerAccount")
            )}
          </button>
          <p className="privacy-note">{t("privacyNotice")}</p>
          <a
            className="registration-policy-link"
            href={PRIVACY_POLICY_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("privacyPolicyLink")}
            <span className="material-symbols-rounded" aria-hidden="true">
              open_in_new
            </span>
            <span className="sr-only">{t("opensNewTab")}</span>
          </a>
        </form>
        <p className="auth-switch">
          {t("alreadyAccount")}{" "}
          <button type="button" className="text-action" onClick={onBack}>
            {t("signIn")}
          </button>
        </p>
      </div>
    </AuthLayout>
  );
}
