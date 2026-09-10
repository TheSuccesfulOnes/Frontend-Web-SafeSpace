import { useLanguage } from "../../../i18n/LanguageProvider";
import { Logo } from "../../../shared/ui/Logo";

export function AuthLayout({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage();
  return (
    <main className="auth-page">
      <section className="auth-card" aria-label={t("appName")}>
        <header className="auth-card-brand">
          <Logo />
          <strong>{t("appName")}</strong>
        </header>
        {children}
      </section>
    </main>
  );
}
