import { useState } from "react";
import type { Profile } from "../../../domain/types";
import { useLanguage } from "../../../i18n/LanguageProvider";

function initials(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}

export function ProfilePage({ profile }: { profile: Profile }) {
  const { t } = useLanguage();
  const [avatar, setAvatar] = useState(
    () => localStorage.getItem(`safespace.avatar.${profile.userId}`) ?? "",
  );
  const [error, setError] = useState("");

  function chooseAvatar(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith("image/") || file.size > 1024 * 1024) {
      setError(t("errorGeneric"));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result);
      setAvatar(value);
      localStorage.setItem(`safespace.avatar.${profile.userId}`, value);
      setError("");
    };
    reader.readAsDataURL(file);
  }

  return (
    <section className="content-stack profile-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">{t("personalSpace")}</span>
          <h2>{t("profileTitle")}</h2>
          <p>{t("profileIntro")}</p>
        </div>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="profile-page-layout">
        <section
          className="profile-identity-card profile-page-card"
          aria-labelledby="profile-page-title"
        >
          <span className="profile-section-kicker">{t("account")}</span>
          <label
            className="profile-avatar-button"
            aria-label={t("displayName")}
          >
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={chooseAvatar}
            />
            {avatar ? (
              <img src={avatar} alt="" />
            ) : (
              <span>{initials(profile.displayName)}</span>
            )}
            <i>+</i>
          </label>
          <p className="avatar-helper">{t("changeAvatar")}</p>
          <h3 id="profile-page-title">{profile.displayName}</h3>
          <span className="profile-handle">@{profile.username}</span>
          <dl>
            <div>
              <dt>{t("email")}</dt>
              <dd>{profile.email || "—"}</dd>
            </div>
            <div>
              <dt>{t("role")}</dt>
              <dd>
                {profile.role === "EMPLOYEE"
                  ? t("roleEmployee")
                  : profile.role === "HR_MEMBER"
                    ? t("roleHrMember")
                    : t("roleSystemAdmin")}
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </section>
  );
}
