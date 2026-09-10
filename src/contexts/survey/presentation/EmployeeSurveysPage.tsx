import { useEffect, useMemo, useState } from "react";
import type {
  Activity,
  Comment,
  ReportPriority,
  Survey,
} from "../../../domain/types";
import { useLanguage } from "../../../i18n/LanguageProvider";
import {
  addComment,
  answerSurvey,
  createReport,
  getActivities,
  getComments,
  getMyReports,
  getSurveys,
  likeComment,
  voteActivity,
} from "../../../infrastructure/content/contentService";
import { isUnauthorized } from "../../../infrastructure/api/apiClient";
import { SuccessMessage } from "../../../shared/ui/SuccessMessage";
import { Spinner } from "../../../shared/ui/Spinner";

type Tab = "daily" | "weekly" | "reports";

function ErrorNotice({ message }: { message: string }) {
  return (
    <p className="form-error" role="alert">
      {message}
    </p>
  );
}

export function EmployeeSurveysPage({
  token,
  onUnauthorized,
}: {
  token: string;
  onUnauthorized: () => void;
}) {
  const { t } = useLanguage();
  const [tab, setTab] = useState<Tab>("daily");
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [reports, setReports] = useState<
    Awaited<ReturnType<typeof getMyReports>>
  >([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    Promise.allSettled([getSurveys(token), getActivities(token)])
      .then(([surveysResult, activitiesResult]) => {
        if (!active) return;

        let hasRequestError = false;
        let unauthorized = false;

        if (surveysResult.status === "fulfilled") {
          setSurveys(surveysResult.value);
        } else if (isUnauthorized(surveysResult.reason)) {
          unauthorized = true;
        } else {
          hasRequestError = true;
        }

        if (activitiesResult.status === "fulfilled") {
          setActivities(activitiesResult.value);
        } else if (isUnauthorized(activitiesResult.reason)) {
          unauthorized = true;
        } else {
          hasRequestError = true;
        }

        if (unauthorized) {
          onUnauthorized();
        } else if (hasRequestError) {
          setError(t("errorGeneric"));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [onUnauthorized, t, token]);

  useEffect(() => {
    if (tab !== "reports") return;
    let active = true;
    setReportsLoading(true);
    setError("");
    getMyReports(token)
      .then((nextReports) => {
        if (active) setReports(nextReports);
      })
      .catch((errorValue: unknown) => {
        if (!active) return;
        if (isUnauthorized(errorValue)) onUnauthorized();
        else setError(t("errorGeneric"));
      })
      .finally(() => {
        if (active) setReportsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [onUnauthorized, tab, t, token]);

  return (
    <section className="content-stack">
      <div className="page-intro">
        <div>
          <span className="eyebrow">{t("yourVoice")}</span>
          <h2>{t("surveyCenter")}</h2>
          <p>{t("surveyCenterIntro")}</p>
        </div>
      </div>
      <div className="tab-switcher" role="tablist" aria-label={t("surveys")}>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "daily"}
          className={tab === "daily" ? "selected" : ""}
          onClick={() => setTab("daily")}
        >
          {t("surveys")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "weekly"}
          className={tab === "weekly" ? "selected" : ""}
          onClick={() => setTab("weekly")}
        >
          {t("weeklyActivities")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "reports"}
          className={tab === "reports" ? "selected" : ""}
          onClick={() => setTab("reports")}
        >
          {t("reports")}
        </button>
      </div>
      {error && <ErrorNotice message={error} />}
      {loading && (
        <div className="empty-state">
          <Spinner /> {t("loading")}
        </div>
      )}
      {!loading && tab === "daily" && (
        <PublishedSurveys
          token={token}
          surveys={surveys}
          onUnauthorized={onUnauthorized}
        />
      )}
      {!loading && tab === "weekly" && (
        <WeeklyActivities
          token={token}
          activities={activities}
          onUnauthorized={onUnauthorized}
        />
      )}
      {!loading && tab === "reports" && (
        <ReportsSection
          token={token}
          reports={reports}
          reportsLoading={reportsLoading}
          onReportsUpdated={setReports}
          onUnauthorized={onUnauthorized}
        />
      )}
    </section>
  );
}

function PublishedSurveys({
  token,
  surveys,
  onUnauthorized,
}: {
  token: string;
  surveys: Survey[];
  onUnauthorized: () => void;
}) {
  const { t } = useLanguage();
  const publishedSurveys = surveys.filter(
    (survey) => survey.status === "PUBLISHED",
  );

  if (!publishedSurveys.length)
    return (
      <div className="empty-state">
        <h3>{t("noSurveys")}</h3>
      </div>
    );
  return (
    <div className="content-list">
      {publishedSurveys.map((survey) => (
        <SurveyCard
          key={survey.id}
          token={token}
          survey={survey}
          onUnauthorized={onUnauthorized}
        />
      ))}
    </div>
  );
}

function SurveyCard({
  token,
  survey,
  onUnauthorized,
}: {
  token: string;
  survey: Survey;
  onUnauthorized: () => void;
}) {
  const { t } = useLanguage();
  const [answer, setAnswer] = useState("");
  const [submitted, setSubmitted] = useState(survey.answered);
  const [comments, setComments] = useState<Comment[]>([]);
  const [likedComments, setLikedComments] = useState<number[]>([]);
  const [comment, setComment] = useState("");
  const [showComments, setShowComments] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!answer.trim()) return;
    setPending(true);
    setError("");
    try {
      await answerSurvey(token, survey.id, answer);
      setSubmitted(true);
    } catch (errorValue) {
      if (isUnauthorized(errorValue)) onUnauthorized();
      else setError(t("errorGeneric"));
    } finally {
      setPending(false);
    }
  }

  async function toggleComments() {
    if (showComments) {
      setShowComments(false);
      return;
    }

    setShowComments(true);
    if (commentsLoaded) return;

    setCommentsLoading(true);
    try {
      setComments(await getComments(token, survey.id));
      setCommentsLoaded(true);
    } catch (errorValue) {
      if (isUnauthorized(errorValue)) onUnauthorized();
      else setError(t("errorGeneric"));
    } finally {
      setCommentsLoading(false);
    }
  }

  async function publishComment() {
    if (!comment.trim()) return;
    try {
      const created = await addComment(token, survey.id, comment);
      setComments((current) => [...current, created]);
      setComment("");
    } catch (errorValue) {
      if (isUnauthorized(errorValue)) onUnauthorized();
      else setError(t("errorGeneric"));
    }
  }

  async function toggleLike(commentId: number) {
    try {
      const wasLiked = likedComments.includes(commentId);
      await likeComment(token, survey.id, commentId);
      setLikedComments((current) =>
        wasLiked
          ? current.filter((id) => id !== commentId)
          : [...current, commentId],
      );
      setComments((current) =>
        current.map((item) =>
          item.id === commentId
            ? { ...item, likes: Math.max(0, item.likes + (wasLiked ? -1 : 1)) }
            : item,
        ),
      );
    } catch (errorValue) {
      if (isUnauthorized(errorValue)) onUnauthorized();
      else setError(t("errorGeneric"));
    }
  }

  return (
    <article className="content-card survey-card">
      <div className="card-meta">
        <span className={`status-tag status-${survey.status.toLowerCase()}`}>
          {submitted ? t("answered") : t("answer")}
        </span>
        <span>{survey.type === "DAILY" ? t("daily") : t("weekly")}</span>
      </div>
      <h3>{survey.title}</h3>
      <p className="card-question">{survey.question}</p>
      {!submitted && (
        <div className="answer-area">
          <textarea
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            rows={2}
            placeholder={t("response")}
            maxLength={1000}
          />
          <button
            type="button"
            className="primary-button compact-button"
            onClick={() => void submit()}
            disabled={pending || !answer.trim()}
          >
            {pending ? <Spinner /> : t("submitAnswer")}
          </button>
        </div>
      )}
      {submitted && <p className="success-line">✓ {t("answered")}</p>}
      {survey.allowComments && (
        <div className="comments-area">
          <button
            type="button"
            className="comments-toggle"
            onClick={() => void toggleComments()}
            aria-expanded={showComments}
            aria-controls={`survey-comments-${survey.id}`}
          >
            <span>
              {showComments ? t("hideComments") : t("showComments")} (
              {comments.length})
            </span>
            <span aria-hidden="true">{showComments ? "⌃" : "⌄"}</span>
          </button>
          {showComments && (
            <div className="comments-panel" id={`survey-comments-${survey.id}`}>
              {commentsLoading ? (
                <div className="comments-loading">
                  <Spinner /> {t("loading")}
                </div>
              ) : (
                <>
                  <div className="comment-list">
                    {comments.length === 0 ? (
                      <p className="comments-empty">{t("noComments")}</p>
                    ) : (
                      comments.map((item) => (
                        <div className="comment-item" key={item.id}>
                          <p>{item.content}</p>
                          <button
                            type="button"
                            className="comment-like"
                            onClick={() => void toggleLike(item.id)}
                          >
                            {likedComments.includes(item.id) ? "♥" : "♡"}{" "}
                            {item.likes}
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="comment-composer">
                    <input
                      value={comment}
                      onChange={(event) => setComment(event.target.value)}
                      placeholder={t("addComment")}
                      maxLength={500}
                    />
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => void publishComment()}
                      aria-label={t("send")}
                    >
                      →
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
      {error && <ErrorNotice message={error} />}
    </article>
  );
}

function WeeklyActivities({
  token,
  activities,
  onUnauthorized,
}: {
  token: string;
  activities: Activity[];
  onUnauthorized: () => void;
}) {
  const { t } = useLanguage();
  const openActivities = activities.filter(
    (activity) => activity.status === "OPEN",
  );

  if (!openActivities.length)
    return (
      <div className="empty-state">
        <h3>{t("noActivities")}</h3>
      </div>
    );
  return (
    <div className="content-list">
      {openActivities.map((activity) => (
        <ActivityCard
          key={activity.id}
          token={token}
          activity={activity}
          onUnauthorized={onUnauthorized}
        />
      ))}
    </div>
  );
}

function ActivityCard({
  token,
  activity,
  onUnauthorized,
}: {
  token: string;
  activity: Activity;
  onUnauthorized: () => void;
}) {
  const { t } = useLanguage();
  const [selected, setSelected] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [voted, setVoted] = useState(false);
  const [error, setError] = useState("");
  const total = useMemo(
    () => activity.options.reduce((sum, option) => sum + option.votes, 0),
    [activity.options],
  );
  async function vote() {
    if (!selected) return;
    setPending(true);
    setError("");
    try {
      await voteActivity(token, activity.id, selected);
      setVoted(true);
    } catch (errorValue) {
      if (isUnauthorized(errorValue)) onUnauthorized();
      else setError(t("errorGeneric"));
    } finally {
      setPending(false);
    }
  }
  return (
    <article className="content-card activity-card">
      <div className="card-meta">
        <span className="status-tag status-open">{t("weeklyActivities")}</span>
        <span>
          {activity.status === "OPEN" ? t("activityOpen") : t("activityClosed")}
        </span>
      </div>
      <h3>{activity.title}</h3>
      <p className="card-question">{activity.description}</p>
      <div className="activity-options">
        {activity.options.map((option) => (
          <label
            className={`activity-option ${selected === option.id ? "selected" : ""}`}
            key={option.id}
          >
            <input
              type="radio"
              name={`activity-${activity.id}`}
              value={option.id}
              checked={selected === option.id}
              onChange={() => setSelected(option.id)}
            />
            <span>
              <strong>{option.label}</strong>
              <small>
                {option.percentage}% · {option.votes} {t("votes")}
              </small>
            </span>
            <i style={{ width: `${Math.max(option.percentage, 4)}%` }} />
          </label>
        ))}
      </div>
      <div className="card-footer-actions">
        <span>
          {total} {t("votes")}
        </span>
        <button
          type="button"
          className="primary-button compact-button"
          onClick={() => void vote()}
          disabled={activity.status !== "OPEN" || pending || !selected}
        >
          {pending ? (
            <Spinner />
          ) : activity.status !== "OPEN" ? (
            t("closed")
          ) : voted ? (
            t("voted")
          ) : (
            t("vote")
          )}
        </button>
      </div>
      {error && <ErrorNotice message={error} />}
    </article>
  );
}

function ReportsSection({
  token,
  reports,
  reportsLoading,
  onReportsUpdated,
  onUnauthorized,
}: {
  token: string;
  reports: Awaited<ReturnType<typeof getMyReports>>;
  reportsLoading: boolean;
  onReportsUpdated: (reports: Awaited<ReturnType<typeof getMyReports>>) => void;
  onUnauthorized: () => void;
}) {
  const { language, t } = useLanguage();
  const [form, setForm] = useState({
    category: "",
    title: "",
    description: "",
    priority: "NORMAL" as ReportPriority,
    anonymous: true,
  });
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const valid = Boolean(
    form.category && form.title.trim() && form.description.trim(),
  );
  const categoryLabel = (category: string) =>
    ({
      TI: t("it"),
      ATENCION_AL_CLIENTE: t("customerService"),
      FINANZAS: t("finance"),
      OPERACIONES: t("operations"),
      OTRO: t("other"),
    })[category] ?? category;
  const priorityLabel = (priority: ReportPriority) =>
    ({
      LOW: t("priorityLow"),
      NORMAL: t("priorityNormal"),
      HIGH: t("priorityHigh"),
      URGENT: t("priorityUrgent"),
    })[priority];
  const statusLabel = (status: string) =>
    ({
      NEW: t("reportStatusNew"),
      IN_REVIEW: t("reportStatusInReview"),
      ADDRESSED: t("reportStatusAddressed"),
      CLOSED: t("reportStatusClosed"),
    })[status] ?? status;
  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(language === "es" ? "es-PE" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid) return;
    setPending(true);
    setError("");
    try {
      const created = await createReport(token, form);
      onReportsUpdated([created, ...reports]);
      setMessage(t("reportCreated"));
      setForm({
        category: "",
        title: "",
        description: "",
        priority: "NORMAL",
        anonymous: true,
      });
    } catch (errorValue) {
      if (isUnauthorized(errorValue)) onUnauthorized();
      else
        setError(
          errorValue instanceof Error ? errorValue.message : t("errorGeneric"),
        );
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="report-section">
      <div className="report-header">
        <div>
          <span className="eyebrow">{t("privateChannel")}</span>
          <h3>{t("reportShortcut")}</h3>
          <p>{t("reportShortcutText")}</p>
        </div>
      </div>
      <form className="content-card report-form" onSubmit={submit}>
        <div className="report-form-heading">
          <div>
            <h3>{t("createReport")}</h3>
          </div>
          <p>{t("reportFormHint")}</p>
        </div>
        <label>
          {t("category")}
          <select
            required
            value={form.category}
            onChange={(event) =>
              setForm({ ...form, category: event.target.value })
            }
          >
            <option value="">{t("selectCategory")}</option>
            <option value="TI">{t("it")}</option>
            <option value="ATENCION_AL_CLIENTE">{t("customerService")}</option>
            <option value="FINANZAS">{t("finance")}</option>
            <option value="OPERACIONES">{t("operations")}</option>
            <option value="OTRO">{t("other")}</option>
          </select>
        </label>
        <label>
          {t("title")}
          <input
            required
            value={form.title}
            onChange={(event) =>
              setForm({ ...form, title: event.target.value })
            }
            maxLength={120}
            placeholder={t("title")}
          />
        </label>
        <label>
          {t("description")}
          <textarea
            required
            value={form.description}
            onChange={(event) =>
              setForm({ ...form, description: event.target.value })
            }
            maxLength={2000}
            rows={5}
            placeholder={t("description")}
          />
        </label>
        <label>
          {t("priority")}
          <select
            value={form.priority}
            onChange={(event) =>
              setForm({
                ...form,
                priority: event.target.value as ReportPriority,
              })
            }
          >
            <option value="LOW">{t("priorityLow")}</option>
            <option value="NORMAL">{t("priorityNormal")}</option>
            <option value="HIGH">{t("priorityHigh")}</option>
            <option value="URGENT">{t("priorityUrgent")}</option>
          </select>
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={form.anonymous}
            onChange={(event) =>
              setForm({ ...form, anonymous: event.target.checked })
            }
          />
          {t("anonymous")}
        </label>
        <SuccessMessage message={message} onDismiss={() => setMessage("")} />
        {error && <ErrorNotice message={error} />}
        <button
          type="submit"
          className="primary-button"
          disabled={!valid || pending}
        >
          {pending ? <Spinner /> : t("submitReport")}{" "}
          <span aria-hidden="true">→</span>
        </button>
      </form>
      <section
        className="content-card report-history"
        aria-labelledby="report-history-title"
      >
        <div className="report-history-heading">
          <div>
            <span className="eyebrow">{t("privateChannel")}</span>
            <h3 id="report-history-title">{t("reportHistory")}</h3>
            <p>{t("reportHistoryText")}</p>
          </div>
          <span
            className="report-count"
            aria-label={`${reports.length} ${t("reportHistory")}`}
          >
            {reports.length}
          </span>
        </div>
        {reportsLoading ? (
          <div className="report-history-state">
            <Spinner /> {t("loading")}
          </div>
        ) : reports.length ? (
          <div className="history-list">
            {reports.map((report) => (
              <article className="history-row" key={report.id}>
                <span
                  className={`history-priority priority-${report.priority.toLowerCase()}`}
                  aria-hidden="true"
                />
                <div className="history-row-body">
                  <div className="history-row-top">
                    <div className="history-row-copy">
                      <strong>{report.title}</strong>
                      <span>
                        {categoryLabel(report.category)} ·{" "}
                        {formatDate(report.createdAt)}
                      </span>
                    </div>
                    <div className="history-row-tags">
                      <span
                        className={`status-tag status-${report.status.toLowerCase()}`}
                      >
                        {statusLabel(report.status)}
                      </span>
                      <span
                        className={`priority-tag priority-${report.priority.toLowerCase()}`}
                      >
                        {priorityLabel(report.priority)}
                      </span>
                    </div>
                  </div>
                  <p className="history-row-description">
                    {report.description}
                  </p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="report-history-empty">
            <p>{t("noReports")}</p>
          </div>
        )}
      </section>
    </div>
  );
}
