import { useState } from "react";
import type { FormEvent } from "react";
import { useLanguage } from "../../../i18n/LanguageProvider";
import { requestPasswordRecovery } from "../../../infrastructure/auth/authService";
import { SuccessMessage } from "../../../shared/ui/SuccessMessage";
import { Spinner } from "../../../shared/ui/Spinner";
import { AuthLayout } from "./AuthLayout";

export function RecoveryPage({ onBack }: { onBack: () => void }) {
  const { t } = useLanguage();
  const [identifier, setIdentifier] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      await requestPasswordRecovery(identifier);
      setMessage(t("recoverySent"));
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
      <div className="auth-form-card recovery-card">
        <button type="button" className="back-action" onClick={onBack}>
          ← {t("backToLogin")}
        </button>
        <span className="eyebrow">{t("safeAccess")}</span>
        <h2>{t("recoverTitle")}</h2>
        <p className="form-intro">{t("recoverIntro")}</p>
        <form className="stack-form" onSubmit={submit}>
          <label>
            {t("usernameOrEmail")}
            <input
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              required
              autoComplete="username"
              placeholder={t("usernameOrEmail")}
            />
          </label>
          <SuccessMessage message={message} onDismiss={() => setMessage("")} />
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary-button" type="submit" disabled={pending}>
            {pending ? (
              <>
                <Spinner /> {t("loading")}
              </>
            ) : (
              <>
                {t("requestRecovery")} <span aria-hidden="true">→</span>
              </>
            )}
          </button>
        </form>
      </div>
    </AuthLayout>
  );
}
