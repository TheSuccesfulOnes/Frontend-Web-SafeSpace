import { useLanguage } from "../../i18n/LanguageProvider";

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();
  return (
    <div className="language-switcher" aria-label={t("language")}>
      <button
        type="button"
        className={language === "es" ? "selected" : ""}
        onClick={() => setLanguage("es")}
      >
        ES
      </button>
      <button
        type="button"
        className={language === "en" ? "selected" : ""}
        onClick={() => setLanguage("en")}
      >
        EN
      </button>
    </div>
  );
}
