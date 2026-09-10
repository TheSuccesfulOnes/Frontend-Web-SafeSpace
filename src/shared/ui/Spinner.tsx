import { useLanguage } from "../../i18n/LanguageProvider";

export function Spinner() {
  const { t } = useLanguage();
  return <span className="spinner" aria-label={t("loading")} />;
}
