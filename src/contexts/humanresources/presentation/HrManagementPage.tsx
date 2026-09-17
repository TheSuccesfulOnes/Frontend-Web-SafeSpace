import { useEffect, useRef, useState } from "react";
import type { Activity, Comment, Survey } from "../../../domain/types";
import { useLanguage } from "../../../i18n/LanguageProvider";
import {
  changeSurveyStatus,
  closeActivity,
  createActivity,
  createSurvey,
  getComments,
  getManagedActivities,
  getManagedSurveys,
} from "../../../infrastructure/content/contentService";
import { isUnauthorized } from "../../../infrastructure/api/apiClient";
import { SuccessMessage } from "../../../shared/ui/SuccessMessage";
import { Spinner } from "../../../shared/ui/Spinner";
import { useLiveRefresh } from "../../../shared/hooks/useLiveRefresh";

type ManagementTab = "surveys" | "activities";

export function HrManagementPage({
  token,
  onUnauthorized,
}: {
  token: string;
  onUnauthorized: () => void;
}) {
  const { t } = useLanguage();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activeForm, setActiveForm] = useState<"survey" | "activity" | null>(
    null,
  );
  const [activeTab, setActiveTab] = useState<ManagementTab>("surveys");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [expandedSurveyId, setExpandedSurveyId] = useState<number | null>(null);
  const [surveyComments, setSurveyComments] = useState<
    Record<number, Comment[]>
  >({});
  const [commentsLoadingId, setCommentsLoadingId] = useState<number | null>(
    null,
  );
  const [commentsError, setCommentsError] = useState("");
  const requestInFlightRef = useRef(false);

  async function load(background = false) {
    if (requestInFlightRef.current) return;
    requestInFlightRef.current = true;
    if (!background) setLoading(true);
    setError("");
    if (!background) {
      setExpandedSurveyId(null);
      setSurveyComments({});
    }
    try {
      const [nextSurveys, nextActivities] = await Promise.all([
        getManagedSurveys(token),
        getManagedActivities(token),
      ]);
      setSurveys(nextSurveys);
      setActivities(nextActivities);
    } catch (errorValue) {
      if (isUnauthorized(errorValue)) onUnauthorized();
      else setError(t("errorGeneric"));
    } finally {
      requestInFlightRef.current = false;
      if (!background) setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, [token]);

  useLiveRefresh(() => load(true));

  async function publishOrClose(survey: Survey) {
    try {
      const updated = await changeSurveyStatus(
        token,
        survey.id,
        survey.status === "PUBLISHED" ? "close" : "publish",
      );
      setSurveys((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setMessage(survey.status === "PUBLISHED" ? t("closed") : t("published"));
    } catch (errorValue) {
      if (isUnauthorized(errorValue)) onUnauthorized();
      else setError(t("errorGeneric"));
    }
  }
  async function close(activity: Activity) {
    try {
      await closeActivity(token, activity.id);
      await load();
      setMessage(t("closed"));
    } catch (errorValue) {
      if (isUnauthorized(errorValue)) onUnauthorized();
      else setError(t("errorGeneric"));
    }
  }

  async function toggleSurveyComments(surveyId: number) {
    if (expandedSurveyId === surveyId) {
      setExpandedSurveyId(null);
      return;
    }

    setExpandedSurveyId(surveyId);
    setCommentsError("");
    if (surveyComments[surveyId]) return;

    setCommentsLoadingId(surveyId);
    try {
      const comments = await getComments(token, surveyId);
      setSurveyComments((current) => ({ ...current, [surveyId]: comments }));
    } catch (errorValue) {
      if (isUnauthorized(errorValue)) onUnauthorized();
      else setCommentsError(t("errorGeneric"));
    } finally {
      setCommentsLoadingId(null);
    }
  }

  return (
    <section className="content-stack">
      <div className="page-intro">
        <div>
          <span className="eyebrow">{t("teamContent")}</span>
          <h2>{t("content")}</h2>
          <p>{t("manageContent")}</p>
        </div>
        <div className="section-actions">
          <button
            type="button"
            className="secondary-button refresh-button"
            onClick={() => void load()}
            disabled={loading}
            aria-busy={loading}
            aria-label={t("refresh")}
          >
            {loading ? <Spinner /> : <span aria-hidden="true">↻</span>}
            {t("refresh")}
          </button>
          {activeTab === "surveys" && (
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                setActiveForm(activeForm === "survey" ? null : "survey")
              }
            >
              {t("newSurvey")} +
            </button>
          )}
          {activeTab === "activities" && (
            <button
              type="button"
              className="primary-button"
              onClick={() =>
                setActiveForm(activeForm === "activity" ? null : "activity")
              }
            >
              {t("newActivity")} +
            </button>
          )}
        </div>
      </div>
      <SuccessMessage message={message} onDismiss={() => setMessage("")} />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {activeForm === "survey" && (
        <SurveyCreateForm
          token={token}
          onCreated={(survey) => {
            setSurveys((current) => [survey, ...current]);
            setActiveForm(null);
            setMessage(t("create"));
          }}
          onUnauthorized={onUnauthorized}
        />
      )}
      {activeForm === "activity" && (
        <ActivityCreateForm
          token={token}
          onCreated={(activity) => {
            setActivities((current) => [activity, ...current]);
            setActiveForm(null);
            setMessage(t("create"));
          }}
          onUnauthorized={onUnauthorized}
        />
      )}
      <div
        className="tab-switcher management-tabs"
        role="tablist"
        aria-label={t("content")}
      >
        <button
          type="button"
          role="tab"
          id="management-surveys-tab"
          aria-selected={activeTab === "surveys"}
          aria-controls="management-surveys-panel"
          className={activeTab === "surveys" ? "selected" : ""}
          onClick={() => {
            setActiveTab("surveys");
            setActiveForm(null);
          }}
        >
          {t("surveys")} <span>{surveys.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          id="management-activities-tab"
          aria-selected={activeTab === "activities"}
          aria-controls="management-activities-panel"
          className={activeTab === "activities" ? "selected" : ""}
          onClick={() => {
            setActiveTab("activities");
            setActiveForm(null);
          }}
        >
          {t("weeklyActivities")} <span>{activities.length}</span>
        </button>
      </div>
      <div
        className="management-tab-panel"
        role="tabpanel"
        id={`management-${activeTab}-panel`}
        aria-labelledby={`management-${activeTab}-tab`}
      >
        {loading ? (
          <div className="empty-state">
            <Spinner /> {t("loading")}
          </div>
        ) : activeTab === "surveys" ? (
          <ManagementSection
            count={surveys.length}
            description={t("manageSurveys")}
            emptyMessage={t("noManagedSurveys")}
            id="management-surveys"
            title={t("surveys")}
          >
            {surveys.map((survey) => (
              <article
                className="content-card manage-card"
                key={`survey-${survey.id}`}
              >
                <div className="manage-card-main">
                  <span className="eyebrow">
                    {survey.type === "DAILY" ? t("daily") : t("weekly")}
                  </span>
                  <h3>{survey.title}</h3>
                  <p>{survey.question}</p>
                  <div
                    className="management-meta"
                    aria-label={t("surveySummary")}
                  >
                    <span>
                      {survey.answers} {t("responses")}
                    </span>
                    <span>
                      {survey.allowComments
                        ? t("commentsEnabled")
                        : t("commentsDisabled")}
                    </span>
                  </div>
                </div>
                <div className="manage-card-footer">
                  <span
                    className={`status-tag status-${survey.status.toLowerCase()}`}
                  >
                    {survey.status === "PUBLISHED"
                      ? t("published")
                      : survey.status === "CLOSED"
                        ? t("closed")
                        : t("draft")}
                  </span>
                  <div className="manage-card-actions">
                    {survey.allowComments && (
                      <button
                        type="button"
                        className="secondary-button compact-button"
                        onClick={() => void toggleSurveyComments(survey.id)}
                        aria-expanded={expandedSurveyId === survey.id}
                        aria-controls={`managed-comments-${survey.id}`}
                      >
                        {expandedSurveyId === survey.id
                          ? t("hideComments")
                          : t("showComments")}
                      </button>
                    )}
                    {survey.status !== "CLOSED" && (
                      <button
                        type="button"
                        className="secondary-button compact-button"
                        onClick={() => void publishOrClose(survey)}
                      >
                        {survey.status === "PUBLISHED"
                          ? t("close")
                          : t("publish")}
                      </button>
                    )}
                  </div>
                </div>
                {expandedSurveyId === survey.id && (
                  <ManagedSurveyComments
                    comments={surveyComments[survey.id] ?? []}
                    error={commentsError}
                    loading={commentsLoadingId === survey.id}
                    panelId={`managed-comments-${survey.id}`}
                  />
                )}
              </article>
            ))}
          </ManagementSection>
        ) : (
          <ManagementSection
            count={activities.length}
            description={t("manageActivities")}
            emptyMessage={t("noManagedActivities")}
            id="management-activities"
            title={t("weeklyActivities")}
          >
            {activities.map((activity) => (
              <article
                className="content-card manage-card"
                key={`activity-${activity.id}`}
              >
                <div className="manage-card-main">
                  <span className="eyebrow">{t("weeklyActivities")}</span>
                  <h3>{activity.title}</h3>
                  <p>{activity.description}</p>
                </div>
                <div className="manage-card-footer">
                  <span
                    className={`status-tag status-${activity.status.toLowerCase()}`}
                  >
                    {activity.status === "OPEN"
                      ? t("activityOpen")
                      : t("activityClosed")}
                  </span>
                  {activity.status === "OPEN" && (
                    <button
                      type="button"
                      className="secondary-button compact-button"
                      onClick={() => void close(activity)}
                    >
                      {t("close")}
                    </button>
                  )}
                </div>
                <ActivityResults activity={activity} />
              </article>
            ))}
          </ManagementSection>
        )}
      </div>
    </section>
  );
}

function ManagementSection({
  children,
  count,
  description,
  emptyMessage,
  id,
  title,
}: {
  children: React.ReactNode;
  count: number;
  description: string;
  emptyMessage: string;
  id: string;
  title: string;
}) {
  const { t } = useLanguage();

  return (
    <section className="management-section" aria-labelledby={`${id}-title`}>
      <header className="management-section-heading">
        <div className="management-section-copy">
          <div>
            <span className="eyebrow">{t("content")}</span>
            <h3 id={`${id}-title`}>{title}</h3>
            <p>{description}</p>
          </div>
        </div>
      </header>
      <div className="content-list management-list">
        {count === 0 ? (
          <p className="management-empty">{emptyMessage}</p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

function ManagedSurveyComments({
  comments,
  error,
  loading,
  panelId,
}: {
  comments: Comment[];
  error: string;
  loading: boolean;
  panelId: string;
}) {
  const { t } = useLanguage();

  return (
    <div className="comments-panel management-comments-panel" id={panelId}>
      <div className="management-subheading">
        <div>
          <span className="eyebrow">{t("comments")}</span>
          <strong>
            {comments.length} {t("commentsCount")}
          </strong>
        </div>
        <span className="management-anonymity-note">{t("anonymousOnly")}</span>
      </div>
      {loading ? (
        <div className="comments-loading">
          <Spinner /> {t("loading")}
        </div>
      ) : error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : comments.length === 0 ? (
        <p className="comments-empty">{t("noComments")}</p>
      ) : (
        <div className="comment-list">
          {comments.map((comment) => (
            <ManagedComment key={comment.id} comment={comment} />
          ))}
        </div>
      )}
    </div>
  );
}

function ManagedComment({
  comment,
  depth = 0,
}: {
  comment: Comment;
  depth?: number;
}) {
  const { t } = useLanguage();

  return (
    <div className={depth > 0 ? "comment-item comment-reply" : "comment-item"}>
      <p>{comment.content}</p>
      <span
        className="comment-like"
        aria-label={`${comment.likes} ${t("likes")}`}
      >
        {comment.likes > 0 ? "♥" : "♡"} {comment.likes}
      </span>
      {comment.replies.length > 0 && (
        <div className="comment-replies">
          {comment.replies.map((reply) => (
            <ManagedComment key={reply.id} comment={reply} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityResults({ activity }: { activity: Activity }) {
  const { t } = useLanguage();
  const totalVotes = activity.options.reduce(
    (total, option) => total + option.votes,
    0,
  );
  const topVotes = Math.max(
    ...activity.options.map((option) => option.votes),
    0,
  );
  const hasVotes = totalVotes > 0;

  return (
    <div className="management-results">
      <div className="management-subheading">
        <div>
          <span className="eyebrow">
            {activity.status === "CLOSED"
              ? t("finalResults")
              : t("currentResults")}
          </span>
          <strong>
            {totalVotes} {t("votes")}
          </strong>
        </div>
        {activity.status === "CLOSED" && hasVotes && (
          <span className="result-state-badge">{t("finalized")}</span>
        )}
      </div>
      {hasVotes ? (
        <div className="management-result-list">
          {activity.options.map((option) => {
            const percentage = Math.max(0, Math.min(100, option.percentage));
            const isWinner = option.votes === topVotes;
            return (
              <div
                className={
                  isWinner ? "management-result is-winner" : "management-result"
                }
                key={option.id}
              >
                <div className="management-result-label">
                  <span>{option.label}</span>
                  <strong>{Math.round(percentage)}%</strong>
                </div>
                <div
                  className="result-track"
                  role="progressbar"
                  aria-label={option.label}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(percentage)}
                >
                  <span style={{ width: `${percentage}%` }} />
                </div>
                <small>
                  {option.votes} {t("votes")}
                  {isWinner && <em>{t("mostVoted")}</em>}
                </small>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="management-results-empty">{t("noVotesYet")}</p>
      )}
    </div>
  );
}

function SurveyCreateForm({
  token,
  onCreated,
  onUnauthorized,
}: {
  token: string;
  onCreated: (survey: Survey) => void;
  onUnauthorized: () => void;
}) {
  const { t } = useLanguage();
  const [form, setForm] = useState({
    title: "",
    question: "",
    type: "DAILY" as "DAILY" | "WEEKLY",
    allowComments: true,
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      onCreated(await createSurvey(token, form));
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
    <form className="content-card inline-create-form" onSubmit={submit}>
      <div className="section-heading">
        <h3>{t("newSurvey")}</h3>
      </div>
      <div className="form-columns">
        <label>
          {t("surveyTitle")}
          <input
            value={form.title}
            onChange={(event) =>
              setForm({ ...form, title: event.target.value })
            }
            required
            maxLength={150}
            placeholder={t("surveyTitle")}
          />
        </label>
        <label>
          {t("surveyQuestion")}
          <input
            value={form.question}
            onChange={(event) =>
              setForm({ ...form, question: event.target.value })
            }
            required
            maxLength={500}
            placeholder={t("surveyQuestion")}
          />
        </label>
      </div>
      <label>
        {t("surveyType")}
        <select
          value={form.type}
          onChange={(event) =>
            setForm({ ...form, type: event.target.value as "DAILY" | "WEEKLY" })
          }
        >
          <option value="DAILY">{t("daily")}</option>
          <option value="WEEKLY">{t("weekly")}</option>
        </select>
      </label>
      <label className="check-row">
        <input
          type="checkbox"
          checked={form.allowComments}
          onChange={(event) =>
            setForm({ ...form, allowComments: event.target.checked })
          }
        />
        {t("allowComments")}
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="primary-button" disabled={pending}>
        {pending ? <Spinner /> : t("create")} <span aria-hidden="true">→</span>
      </button>
    </form>
  );
}

function ActivityCreateForm({
  token,
  onCreated,
  onUnauthorized,
}: {
  token: string;
  onCreated: (activity: Activity) => void;
  onUnauthorized: () => void;
}) {
  const { t } = useLanguage();
  const [form, setForm] = useState({
    title: "",
    description: "",
    options: ["", ""],
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const options = form.options.map((option) => option.trim()).filter(Boolean);
    if (options.length < 2) {
      setError(t("errorGeneric"));
      return;
    }
    setPending(true);
    setError("");
    try {
      onCreated(await createActivity(token, { ...form, options }));
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
    <form className="content-card inline-create-form" onSubmit={submit}>
      <div className="section-heading">
        <h3>{t("newActivity")}</h3>
      </div>
      <label>
        {t("activityTitle")}
        <input
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
          required
          maxLength={150}
          placeholder={t("activityTitle")}
        />
      </label>
      <label>
        {t("activityDescription")}
        <textarea
          value={form.description}
          onChange={(event) =>
            setForm({ ...form, description: event.target.value })
          }
          rows={3}
          maxLength={500}
          placeholder={t("activityDescription")}
        />
      </label>
      <div className="option-fields">
        <span className="field-label">{t("options")}</span>
        {form.options.map((option, index) => (
          <input
            key={index}
            value={option}
            onChange={(event) =>
              setForm({
                ...form,
                options: form.options.map((value, valueIndex) =>
                  valueIndex === index ? event.target.value : value,
                ),
              })
            }
            required
            placeholder={`${t("option")} ${index + 1}`}
          />
        ))}
        <button
          type="button"
          className="inline-link-button"
          onClick={() => setForm({ ...form, options: [...form.options, ""] })}
        >
          + {t("addOption")}
        </button>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="primary-button" disabled={pending}>
        {pending ? <Spinner /> : t("create")} <span aria-hidden="true">→</span>
      </button>
    </form>
  );
}
