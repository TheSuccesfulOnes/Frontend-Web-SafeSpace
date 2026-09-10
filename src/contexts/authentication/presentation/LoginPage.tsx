import { useState } from "react";
import type { FormEvent } from "react";
import type { AuthSession } from "../../../domain/types";
import { useLanguage } from "../../../i18n/LanguageProvider";
import { login } from "../../../infrastructure/auth/authService";
import { Spinner } from "../../../shared/ui/Spinner";
import { AuthLayout } from "./AuthLayout";

type LoginPageProps = {
  onLogin: (session: AuthSession) => void;
  onRegister: () => void;
  onRecovery: () => void;
};

export function LoginPage({ onLogin, onRegister, onRecovery }: LoginPageProps) {
  const { t } = useLanguage();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!identifier.trim() || !password) return;
    setPending(true);
    setError("");
    try {
      const nextSession = await login(identifier, password);
      if (nextSession.role === "SYSTEM_ADMIN") {
        throw new Error(t("systemAdminPortal"));
      }
      onLogin(nextSession);
    } catch (errorValue) {
      setError(
        errorValue instanceof Error ? errorValue.message : t("errorGeneric"),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout>
      <div className="auth-form-card">
        <h2>{t("welcomeBack")}</h2>
        <p className="form-intro">{t("safeSpaceIntro")}</p>
        <form className="stack-form" onSubmit={submit}>
          <label>
            {t("usernameOrEmail")}
            <input
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              autoComplete="username"
              required
              placeholder={t("usernameOrEmail")}
            />
          </label>
          <div className="label-with-action">
            <label>
              {t("password")}
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
                placeholder="••••••••"
              />
            </label>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button type="button" className="text-action" onClick={onRecovery}>
            {t("forgotPassword")}
          </button>
          <button className="primary-button" type="submit" disabled={pending}>
            {pending ? (
              <>
                <Spinner /> {t("signingIn")}
              </>
            ) : (
              t("signIn")
            )}
          </button>
        </form>

        <p className="auth-switch">
          {t("noAccount")}{" "}
          <button type="button" className="text-action" onClick={onRegister}>
            {t("register")}
          </button>
        </p>
      </div>

    </AuthLayout>
  );
}
