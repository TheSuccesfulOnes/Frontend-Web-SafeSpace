import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  deleteComment,
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
  const [refreshing, setRefreshing] = useState(false);
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

  async function refreshCurrentTab() {
    if (loading || refreshing || reportsLoading) return;
    setRefreshing(true);
    setError("");
    try {
      if (tab === "reports") {
        setReports(await getMyReports(token));
      } else {
        const [nextSurveys, nextActivities] = await Promise.all([
          getSurveys(token),
          getActivities(token),
        ]);
        setSurveys(nextSurveys);
        setActivities(nextActivities);
      }
    } catch (errorValue) {
      if (isUnauthorized(errorValue)) onUnauthorized();
      else setError(t("errorGeneric"));
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <section className="content-stack">
      <div className="page-intro">
        <div>
          <span className="eyebrow">{t("yourVoice")}</span>
          <h2>{t("surveyCenter")}</h2>
          <p>{t("surveyCenterIntro")}</p>
        </div>
      </div>
      <div className="survey-tabs-toolbar">
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
        <button
          type="button"
          className="secondary-button refresh-button survey-refresh-button"
          onClick={() => void refreshCurrentTab()}
          disabled={loading || refreshing || reportsLoading}
          aria-busy={refreshing || reportsLoading}
          aria-label={t("refresh")}
        >
          {refreshing || reportsLoading ? (
            <Spinner />
          ) : (
            <span aria-hidden="true">↻</span>
          )}
          {t("refresh")}
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
  const [commentsCount, setCommentsCount] = useState<number | null>(null);
  const [likedComments, setLikedComments] = useState<number[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [commentsPending, setCommentsPending] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const commentsRequestRef = useRef<Promise<Comment[]> | null>(null);

  useEffect(() => {
    setSubmitted(survey.answered);
  }, [survey.answered]);

  const requestComments = useCallback(() => {
    const existingRequest = commentsRequestRef.current;
    if (existingRequest) return existingRequest;

    const request = getComments(token, survey.id);
    const trackedRequest = request.finally(() => {
      if (commentsRequestRef.current === trackedRequest) {
        commentsRequestRef.current = null;
      }
    });
    commentsRequestRef.current = trackedRequest;
    return trackedRequest;
  }, [survey.id, token]);

  useEffect(() => {
    if (!survey.allowComments) return;
    let active = true;
    setCommentsLoading(true);

    void requestComments()
      .then((nextComments) => {
        if (!active) return;
        setComments(nextComments);
        setCommentsCount(nextComments.length);
        setCommentsLoaded(true);
      })
      .catch((errorValue: unknown) => {
        if (!active) return;
        if (isUnauthorized(errorValue)) onUnauthorized();
        else setError(t("errorGeneric"));
      })
      .finally(() => {
        if (active) setCommentsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [onUnauthorized, requestComments, survey.allowComments, t]);

  async function refreshComments(showLoading = false): Promise<boolean> {
    if (showLoading) setCommentsLoading(true);
    try {
      const nextComments = await requestComments();
      setComments(nextComments);
      setCommentsCount(nextComments.length);
      setCommentsLoaded(true);
      return true;
    } catch (errorValue) {
      if (isUnauthorized(errorValue)) onUnauthorized();
      else setError(t("errorGeneric"));
      return false;
    } finally {
      if (showLoading) setCommentsLoading(false);
    }
  }

  async function submit() {
    if (!answer.trim()) return;
    setPending(true);
    setError("");
    try {
      await answerSurvey(token, survey.id, answer);
      setSubmitted(true);
      setAnswer("");
      // Survey answers are also anonymous root comments in the backend.
      if (survey.allowComments) await refreshComments();
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

    await refreshComments(true);
  }

  async function publishReply(content: string, parentId: number) {
    if (!content.trim()) return false;
    setCommentsPending(true);
    setError("");
    try {
      await addComment(token, survey.id, content, parentId);
      const refreshed = await refreshComments();
      if (refreshed) setMessage(t("commentPublished"));
      return refreshed;
    } catch (errorValue) {
      if (isUnauthorized(errorValue)) onUnauthorized();
      else setError(t("errorGeneric"));
      return false;
    } finally {
      setCommentsPending(false);
    }
  }

  async function toggleLike(commentId: number) {
    setCommentsPending(true);
    setError("");
    try {
      const wasLiked = likedComments.includes(commentId);
      await likeComment(token, survey.id, commentId);
      setLikedComments((current) =>
        wasLiked
          ? current.filter((id) => id !== commentId)
          : [...current, commentId],
      );
      await refreshComments();
    } catch (errorValue) {
      if (isUnauthorized(errorValue)) onUnauthorized();
      else setError(t("errorGeneric"));
    } finally {
      setCommentsPending(false);
    }
  }

  async function removeComment(commentId: number) {
    setCommentsPending(true);
    setError("");
    try {
      await deleteComment(token, survey.id, commentId);
      const refreshed = await refreshComments();
      if (refreshed) setMessage(t("commentDeleted"));
      return refreshed;
    } catch (errorValue) {
      if (isUnauthorized(errorValue)) onUnauthorized();
      else setError(t("errorGeneric"));
      return false;
    } finally {
      setCommentsPending(false);
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
            placeholder={t("answerPlaceholder")}
            aria-label={t("response")}
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
      <SuccessMessage message={message} onDismiss={() => setMessage("")} />
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
              {commentsCount === null ? "…" : commentsCount})
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
                        <CommentThread
                          key={item.id}
                          comment={item}
                          isPending={commentsPending}
                          likedComments={likedComments}
                          onDelete={removeComment}
                          onLike={toggleLike}
                          onReply={publishReply}
                        />
                      ))
                    )}
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

function CommentThread({
  comment,
  isPending,
  likedComments,
  onDelete,
  onLike,
  onReply,
  depth = 0,
}: {
  comment: Comment;
  isPending: boolean;
  likedComments: number[];
  onDelete: (commentId: number) => Promise<boolean>;
  onLike: (commentId: number) => Promise<void>;
  onReply: (content: string, parentId: number) => Promise<boolean>;
  depth?: number;
}) {
  const { t } = useLanguage();
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);
  const [repliesExpanded, setRepliesExpanded] = useState(false);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);

  const replyCountLabel = (count: number) =>
    (count === 1 ? t("viewReply") : t("viewReplies")).replace(
      "{count}",
      String(count),
    );

  async function submitReply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const posted = await onReply(replyText, comment.id);
    if (posted) {
      setReplyText("");
      setReplying(false);
    }
  }

  async function confirmDelete() {
    const deleted = await onDelete(comment.id);
    if (deleted) setDeleteConfirmationOpen(false);
  }

  return (
    <div className="comment-thread">
      <article className={`comment-item ${depth > 0 ? "comment-reply" : ""}`}>
        {depth > 0 && <span className="comment-kind">{t("replyLabel")}</span>}
        <p>{comment.content}</p>
        <div className="comment-actions">
          {depth === 0 && (
            <button
              type="button"
              className={`comment-action comment-like-action ${likedComments.includes(comment.id) ? "is-liked" : ""}`}
              onClick={() => void onLike(comment.id)}
              disabled={isPending}
            >
              <span aria-hidden="true">
                {likedComments.includes(comment.id) ? "♥" : "♡"}
              </span>
              <span>{comment.likes}</span>
            </button>
          )}
          {depth === 0 && (
            <button
              type="button"
              className="comment-action comment-reply-action"
              onClick={() => setReplying((current) => !current)}
              disabled={isPending}
              aria-expanded={replying}
            >
              {replying ? t("closeReply") : t("reply")}
            </button>
          )}
          {depth === 0 && comment.replies.length > 0 && (
            <button
              type="button"
              className="comment-replies-toggle"
              onClick={() => setRepliesExpanded((current) => !current)}
              disabled={isPending}
              aria-expanded={repliesExpanded}
            >
              <span className="material-symbols-rounded" aria-hidden="true">
                {repliesExpanded ? "expand_less" : "expand_more"}
              </span>
              {repliesExpanded
                ? t("closeReplies")
                : replyCountLabel(comment.replies.length)}
            </button>
          )}
          {comment.canDelete && (
            <button
              type="button"
              className="comment-action comment-delete-action"
              onClick={() => setDeleteConfirmationOpen(true)}
              disabled={isPending}
              aria-label={t("deleteComment")}
            >
              <span className="material-symbols-rounded" aria-hidden="true">
                delete
              </span>
              <span>{t("delete")}</span>
            </button>
          )}
        </div>
      </article>
      {depth === 0 && replying && (
        <form className="comment-reply-form" onSubmit={submitReply}>
          <label>
            <span className="sr-only">{t("replyLabel")}</span>
            <input
              value={replyText}
              onChange={(event) => setReplyText(event.target.value)}
              placeholder={t("replyPlaceholder")}
              maxLength={1000}
              disabled={isPending}
            />
          </label>
          <button
            type="submit"
            className="primary-button compact-button"
            disabled={isPending || !replyText.trim()}
          >
            {isPending ? <Spinner /> : t("publishReply")}
          </button>
        </form>
      )}
      {depth === 0 && repliesExpanded && comment.replies.length > 0 && (
        <div
          className="comment-replies"
          aria-label={t("viewReplies").replace(
            "{count}",
            String(comment.replies.length),
          )}
        >
          {comment.replies.map((reply) => (
            <CommentThread
              key={reply.id}
              comment={reply}
              depth={1}
              isPending={isPending}
              likedComments={likedComments}
              onDelete={onDelete}
              onLike={onLike}
              onReply={onReply}
            />
          ))}
        </div>
      )}
      {deleteConfirmationOpen && (
        <CommentDeleteDialog
          isPending={isPending}
          onCancel={() => setDeleteConfirmationOpen(false)}
          onConfirm={() => void confirmDelete()}
        />
      )}
    </div>
  );
}

function CommentDeleteDialog({
  isPending,
  onCancel,
  onConfirm,
}: {
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useLanguage();
  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal-card comment-delete-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="comment-delete-title"
      >
        <span className="eyebrow">{t("comments")}</span>
        <h2 id="comment-delete-title">{t("deleteComment")}</h2>
        <p className="form-intro">{t("deleteCommentText")}</p>
        <div className="modal-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={onCancel}
            disabled={isPending}
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            className="primary-button danger-button"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? <Spinner /> : t("delete")}
          </button>
        </div>
      </div>
    </div>
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
  const [votedOptionId, setVotedOptionId] = useState<number | null>(null);
  const [options, setOptions] = useState(activity.options);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    setOptions(activity.options);
  }, [activity.options]);

  const total = useMemo(
    () => options.reduce((sum, option) => sum + option.votes, 0),
    [options],
  );

  function formatPercentage(value: number): string {
    const normalized = Number.isFinite(value)
      ? Math.min(100, Math.max(0, value))
      : 0;
    return `${normalized.toFixed(1)}%`;
  }

  async function vote() {
    if (selected === null) return;
    setPending(true);
    setError("");
    try {
      await voteActivity(token, activity.id, selected);
      setVotedOptionId(selected);
      setVoted(true);
      setMessage(t("voteRecorded"));

      // Refresh the activity so percentages and totals reflect the persisted vote.
      try {
        const latestActivities = await getActivities(token);
        const latestActivity = latestActivities.find(
          (item) => item.id === activity.id,
        );
        if (latestActivity) setOptions(latestActivity.options);
      } catch (refreshError) {
        if (isUnauthorized(refreshError)) onUnauthorized();
        else setError(t("errorGeneric"));
      }
    } catch (errorValue) {
      if (isUnauthorized(errorValue)) onUnauthorized();
      else setError(t("errorGeneric"));
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      {message && (
        <div className="activity-vote-message">
          <SuccessMessage message={message} onDismiss={() => setMessage("")} />
        </div>
      )}
      <article className="content-card activity-card">
        <div className="card-meta">
          <span className="status-tag status-open">
            {t("weeklyActivities")}
          </span>
          <span>
            {activity.status === "OPEN"
              ? t("activityOpen")
              : t("activityClosed")}
          </span>
        </div>
        <h3>{activity.title}</h3>
        <p className="card-question">{activity.description}</p>
        <div className="activity-options">
          {options.map((option) => (
            <label
              className={`activity-option ${selected === option.id ? "selected" : ""} ${votedOptionId === option.id ? "voted" : ""}`}
              key={option.id}
            >
              <input
                type="radio"
                name={`activity-${activity.id}`}
                value={option.id}
                checked={selected === option.id}
                onChange={() => setSelected(option.id)}
              />
              <span className="activity-option-copy">
                <strong>{option.label}</strong>
                <small>
                  {formatPercentage(option.percentage)} · {option.votes}{" "}
                  {t("votes")}
                </small>
                {votedOptionId === option.id && selected === option.id && (
                  <small className="activity-option-voted">
                    <span aria-hidden="true">✓</span> {t("voted")}
                  </small>
                )}
              </span>
              <i
                aria-hidden="true"
                style={{
                  width: `${Math.min(100, Math.max(option.percentage, 4))}%`,
                }}
              />
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
            disabled={
              activity.status !== "OPEN" || pending || selected === null
            }
          >
            {pending ? (
              <Spinner />
            ) : activity.status !== "OPEN" ? (
              t("closed")
            ) : voted && selected === votedOptionId ? (
              t("voted")
            ) : (
              t("vote")
            )}
          </button>
        </div>
        {error && <ErrorNotice message={error} />}
      </article>
    </>
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
