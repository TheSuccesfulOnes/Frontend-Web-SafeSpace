import { useEffect, useMemo, useState } from "react";
import type { Mood, MoodSummary } from "../../../domain/types";
import { useLanguage } from "../../../i18n/LanguageProvider";
import { getMoodSummary } from "../../../infrastructure/content/contentService";
import { isUnauthorized } from "../../../infrastructure/api/apiClient";
import { Spinner } from "../../../shared/ui/Spinner";

const moodColors: Record<Mood, string> = {
  VERY_GOOD: "#426e55",
  GOOD: "#8bb497",
  BAD: "#d9c0f2",
  VERY_BAD: "#80a9df",
};

export function HrHomePage({
  token,
  displayName,
  onUnauthorized,
}: {
  token: string;
  displayName: string;
  onUnauthorized: () => void;
}) {
  const { language, t } = useLanguage();
  const [summary, setSummary] = useState<MoodSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    setLoading(true);
    setError("");
    setSummary(null);
    getMoodSummary(token)
      .then(setSummary)
      .catch((errorValue: unknown) => {
        if (isUnauthorized(errorValue)) onUnauthorized();
        else setError(t("errorGeneric"));
      })
      .finally(() => setLoading(false));
  }, [onUnauthorized, t, token]);

  const chart = useMemo(() => {
    if (!summary) return "conic-gradient(#dfe6e1 0 100%)";
    const total =
      Object.values(summary.distribution).reduce(
        (sum, value) => sum + (value ?? 0),
        0,
      ) || 1;
    let cursor = 0;
    const segments = (
      Object.entries(summary.distribution) as [Mood, number][]
    ).map(([mood, value]) => {
      const start = cursor;
      cursor += ((value ?? 0) / total) * 100;
      return `${moodColors[mood]} ${start}% ${cursor}%`;
    });
    return `conic-gradient(${segments.join(", ")})`;
  }, [summary]);

  const positive = summary
    ? (summary.distribution.VERY_GOOD ?? 0) + (summary.distribution.GOOD ?? 0)
    : 0;
  const total = summary
    ? Object.values(summary.distribution).reduce(
        (sum, value) => sum + (value ?? 0),
        0,
      ) || 1
    : 1;
  const positivePercentage = Math.round((positive / total) * 100);
  const date = summary?.date
    ? new Date(`${summary.date}T12:00:00`)
    : new Date();
  const formattedDate = new Intl.DateTimeFormat(
    language === "es" ? "es-PE" : "en-US",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
    },
  ).format(date);

  return (
    <section className="content-stack">
      <div className="page-intro welcome-intro">
        <div>
          <span className="eyebrow">{formattedDate}</span>
          <h2>
            {t("welcome")}, {displayName}.
          </h2>
          <p>{t("hrSummary")}</p>
        </div>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <section className="analytics-card">
        <div className="card-heading">
          <div>
            <span className="eyebrow">{t("teamPulse")}</span>
            <h3>{t("generalMood")}</h3>
            <p>{t("teamTrend")}</p>
          </div>
          <span className="soft-tag">
            {loading ? (
              <Spinner />
            ) : (
              `${summary?.totalResponses ?? 0} ${t("response")}`
            )}
          </span>
        </div>
        <div className="analytics-body">
          <div className="donut" style={{ background: chart }}>
            <div>
              <strong>
                {loading ? (
                  <Spinner />
                ) : summary ? (
                  `${positivePercentage}%`
                ) : (
                  "—"
                )}
              </strong>
              <span>{t("positive")}</span>
            </div>
          </div>
          <div className="legend">
            {(["VERY_GOOD", "GOOD", "BAD", "VERY_BAD"] as Mood[]).map(
              (mood) => (
                <div className="legend-row" key={mood}>
                  <i style={{ background: moodColors[mood] }} />
                  <span>
                    {mood === "VERY_GOOD"
                      ? t("veryGood")
                      : mood === "GOOD"
                        ? t("good")
                        : mood === "BAD"
                          ? t("bad")
                          : t("veryBad")}
                  </span>
                  <strong>
                    {loading ? "—" : (summary?.distribution[mood] ?? 0)}
                  </strong>
                </div>
              ),
            )}
          </div>
        </div>
      </section>
      <section className="hr-stat-card">
        <div>
          <span className="eyebrow">{t("teamReach")}</span>
          <h3>♧ {t("activeEmployees")}</h3>
          <p>{t("totalInEcosystem")}</p>
        </div>
        <strong>
          {loading ? <Spinner /> : (summary?.activeEmployees ?? "—")}
        </strong>
        <div className="stat-divider" />
        <div className="response-row">
          <span>{t("responseRate")}</span>
          <strong>
            {loading ? <Spinner /> : `${summary?.responseRate ?? 0}%`}
          </strong>
        </div>
        <div className="progress-track">
          <span
            style={{ width: loading ? "0%" : `${summary?.responseRate ?? 0}%` }}
          />
        </div>
      </section>
    </section>
  );
}
