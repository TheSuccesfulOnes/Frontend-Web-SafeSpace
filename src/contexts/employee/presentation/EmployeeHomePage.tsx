import { useEffect, useMemo, useState } from "react";
import type { Mood, MoodToday } from "../../../domain/types";
import { useLanguage } from "../../../i18n/LanguageProvider";
import {
  getTodayMood,
  submitMood,
} from "../../../infrastructure/content/contentService";
import { isUnauthorized } from "../../../infrastructure/api/apiClient";
import { Spinner } from "../../../shared/ui/Spinner";

const moods: {
  value: Mood;
  icon: string;
  key: "veryBad" | "bad" | "good" | "veryGood";
}[] = [
  { value: "VERY_BAD", icon: "😞", key: "veryBad" },
  { value: "BAD", icon: "😕", key: "bad" },
  { value: "GOOD", icon: "🙂", key: "good" },
  { value: "VERY_GOOD", icon: "😄", key: "veryGood" },
];

function greeting(
  t: (key: "goodMorning" | "goodAfternoon" | "goodEvening") => string,
): string {
  const hour = new Date().getHours();
  return hour < 12
    ? t("goodMorning")
    : hour < 19
      ? t("goodAfternoon")
      : t("goodEvening");
}

export function EmployeeHomePage({
  token,
  displayName,
  onUnauthorized,
}: {
  token: string;
  displayName: string;
  onUnauthorized: () => void;
}) {
  const { t } = useLanguage();
  const [todayMood, setTodayMood] = useState<MoodToday | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingMood, setSavingMood] = useState<Mood | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getTodayMood(token)
      .then(setTodayMood)
      .catch((errorValue: unknown) => {
        if (isUnauthorized(errorValue)) onUnauthorized();
        else setError(t("moodUnavailable"));
      })
      .finally(() => setLoading(false));
  }, [onUnauthorized, t, token]);

  const today = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(new Date()),
    [],
  );

  async function selectMood(mood: Mood) {
    if (loading || savingMood !== null || todayMood !== null) return;
    setSavingMood(mood);
    setError("");
    try {
      setTodayMood(await submitMood(token, mood));
    } catch (errorValue) {
      if (isUnauthorized(errorValue)) onUnauthorized();
      else setError(t("errorGeneric"));
    } finally {
      setSavingMood(null);
    }
  }

  return (
    <section className="content-stack">
      <div className="page-intro welcome-intro">
        <div>
          <span className="eyebrow">{today}</span>
          <h2>
            {greeting((key) => t(key))}, {displayName}.
          </h2>
          <p>{t("safeSpaceIntro")}</p>
        </div>
      </div>

      <section
        className={`mood-card ${todayMood ? "mood-card-complete" : ""}`}
        aria-labelledby="mood-heading"
      >
        <div className="card-heading">
          <div>
            <span className="eyebrow">{t("todayCheckIn")}</span>
            <h3 id="mood-heading">{t("todayFeeling")}</h3>
          </div>
          {todayMood && <span className="soft-tag">{t("moodSaved")}</span>}
        </div>
        <div className="mood-options">
          {moods.map((mood) => (
            <button
              key={mood.value}
              type="button"
              className={`mood-option mood-${mood.value.toLowerCase()} ${todayMood?.mood === mood.value ? "selected" : ""}`}
              onClick={() => void selectMood(mood.value)}
              disabled={loading || savingMood !== null || todayMood !== null}
              aria-pressed={todayMood?.mood === mood.value}
            >
              <span className="mood-icon" aria-hidden="true">
                {savingMood === mood.value ? <Spinner /> : mood.icon}
              </span>
              <span>{t(mood.key)}</span>
            </button>
          ))}
        </div>
        {loading && (
          <div className="inline-status">
            <Spinner /> {t("loading")}
          </div>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </section>

      <div className="section-heading compact-heading">
        <div>
          <span className="eyebrow">{t("nextInYourSpace")}</span>
          <h3>{t("upcoming")}</h3>
        </div>
      </div>
      <div className="resource-grid">
        <article className="resource-card resource-lilac">
          <span
            className="resource-icon material-symbols-rounded"
            aria-hidden="true"
          >
            monitor_heart
          </span>
          <div>
            <h3>{t("wellbeingMetrics")}</h3>
            <p>{t("wellbeingMetricsText")}</p>
          </div>
        </article>
        <article className="resource-card resource-blue">
          <span
            className="resource-icon material-symbols-rounded"
            aria-hidden="true"
          >
            self_improvement
          </span>
          <div>
            <h3>{t("guidedResources")}</h3>
            <p>{t("guidedResourcesText")}</p>
          </div>
        </article>
      </div>
    </section>
  );
}
