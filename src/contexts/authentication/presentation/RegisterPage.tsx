import { useState } from "react";
import type { FormEvent } from "react";
import { useLanguage } from "../../../i18n/LanguageProvider";
import { register } from "../../../infrastructure/auth/authService";
import { Spinner } from "../../../shared/ui/Spinner";
import { AuthLayout } from "./AuthLayout";
import { PasswordField } from "../../../shared/ui/PasswordField";

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
    if (!form.displayName.trim()) {
      setError(t("errorGeneric"));
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError(t("errorGeneric"));
      return;
    }
    setPending(true);
    setError("");
    try {
      await register(form);
      onRegistered();
    } catch (errorValue) {
      setError(
        errorValue instanceof Error ? errorValue.message : t("errorGeneric"),
      );
    } finally {
      setPending(false);
    }
  }

  function update(name: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
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
              placeholder="ej. Carlos Mendoza"
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
              placeholder="tu.usuario"
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
              placeholder="tu@correo.com"
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
              placeholder="Mínimo 8 caracteres"
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
              placeholder="Repite tu contraseña"
            />
          </div>
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
