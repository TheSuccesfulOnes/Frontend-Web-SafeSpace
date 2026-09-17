import { useState } from "react";
import type { InputHTMLAttributes } from "react";
import { useLanguage } from "../../i18n/LanguageProvider";

type PasswordFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
> & {
  label: string;
};

export function PasswordField({
  label,
  id,
  ...inputProps
}: PasswordFieldProps) {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  const visibilityLabel = t(visible ? "hidePassword" : "showPassword");

  return (
    <div className="password-field">
      <label htmlFor={id}>{label}</label>
      <div className="password-input-wrap">
        <input {...inputProps} id={id} type={visible ? "text" : "password"} />
        <button
          type="button"
          className="password-toggle"
          aria-label={visibilityLabel}
          aria-pressed={visible}
          title={visibilityLabel}
          onClick={() => setVisible((current) => !current)}
        >
          <span className="material-symbols-rounded" aria-hidden="true">
            {visible ? "visibility_off" : "visibility"}
          </span>
        </button>
      </div>
    </div>
  );
}
