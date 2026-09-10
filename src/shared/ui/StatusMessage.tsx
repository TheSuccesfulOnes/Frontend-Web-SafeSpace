import { useLanguage } from "../../i18n/LanguageProvider";

export function StatusMessage({
  message,
  error = false,
}: {
  message: string;
  error?: boolean;
}) {
  const { t } = useLanguage();
  return (
    <div
      className={`status-message ${error ? "status-message-error" : ""}`}
      role={error ? "alert" : "status"}
    >
      <span>{message}</span>
      {error && <button type="button">{t("retry")}</button>}
    </div>
  );
}
