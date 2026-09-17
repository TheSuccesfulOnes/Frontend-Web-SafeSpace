import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Report,
  ReportPriority,
  ReportStatus,
} from "../../../domain/types";
import { useLanguage } from "../../../i18n/LanguageProvider";
import {
  getAllReports,
  updateReportStatus,
} from "../../../infrastructure/content/contentService";
import { isUnauthorized } from "../../../infrastructure/api/apiClient";
import { Spinner } from "../../../shared/ui/Spinner";
import { useLiveRefresh } from "../../../shared/hooks/useLiveRefresh";

type Filter = "ALL" | "IN_REVIEW" | "ADDRESSED";

export function HrReportsPage({
  token,
  onUnauthorized,
}: {
  token: string;
  onUnauthorized: () => void;
}) {
  const { language, t } = useLanguage();
  const [reports, setReports] = useState<Report[]>([]);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [selected, setSelected] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestInFlightRef = useRef(false);

  async function load(background = false) {
    if (requestInFlightRef.current) return;
    requestInFlightRef.current = true;
    if (!background) setLoading(true);
    setError("");
    if (!background) setSelected(null);
    try {
      const nextReports = await getAllReports(token);
      setReports(nextReports);
      if (background) {
        setSelected((current) =>
          current
            ? (nextReports.find((report) => report.id === current.id) ?? null)
            : null,
        );
      }
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
  }, [onUnauthorized, t, token]);

  useLiveRefresh(() => load(true));
  const visible = useMemo(
    () =>
      reports.filter(
        (report) =>
          filter === "ALL" ||
          (filter === "IN_REVIEW"
            ? report.status === "IN_REVIEW"
            : report.status === "ADDRESSED"),
      ),
    [filter, reports],
  );
  const filterCounts = useMemo(
    () => ({
      ALL: reports.length,
      IN_REVIEW: reports.filter((report) => report.status === "IN_REVIEW")
        .length,
      ADDRESSED: reports.filter((report) => report.status === "ADDRESSED")
        .length,
    }),
    [reports],
  );
  function filterLabel(value: Filter): string {
    return value === "ALL"
      ? t("all")
      : value === "IN_REVIEW"
        ? t("inReview")
        : t("addressed");
  }
  function formatDate(value: string): string {
    return new Intl.DateTimeFormat(language === "es" ? "es-PE" : "en-US", {
      dateStyle: "medium",
    }).format(new Date(value));
  }
  function categoryLabel(category: string): string {
    return category === "TI"
      ? t("it")
      : category === "ATENCION_AL_CLIENTE"
        ? t("customerService")
        : category === "FINANZAS"
          ? t("finance")
          : category === "OPERACIONES"
            ? t("operations")
            : category === "OTRO"
              ? t("other")
              : category;
  }
  function priorityLabel(priority: ReportPriority): string {
    return priority === "LOW"
      ? t("priorityLow")
      : priority === "NORMAL"
        ? t("priorityNormal")
        : priority === "HIGH"
          ? t("priorityHigh")
          : t("priorityUrgent");
  }
  function statusLabel(status: ReportStatus): string {
    return status === "NEW"
      ? t("reportStatusNew")
      : status === "IN_REVIEW"
        ? t("reportStatusInReview")
        : status === "ADDRESSED"
          ? t("reportStatusAddressed")
          : t("reportStatusClosed");
  }
  async function changeStatus(id: number, status: ReportStatus) {
    try {
      const updated = await updateReportStatus(token, id, status);
      setReports((current) =>
        current.map((report) => (report.id === id ? updated : report)),
      );
      setSelected(updated);
    } catch (errorValue) {
      if (isUnauthorized(errorValue)) onUnauthorized();
      else setError(t("errorGeneric"));
    }
  }
  return (
    <section className="content-stack">
      <div className="page-intro">
        <div>
          <span className="eyebrow">{t("privateInbox")}</span>
          <h2>{t("manageReports")}</h2>
          <p>{t("reportsIntro")}</p>
        </div>
      </div>
      <div className="report-filters">
        <div className="report-filter-toolbar">
          <div
            className="tab-switcher"
            role="tablist"
            aria-label={t("reports")}
          >
            <button
              type="button"
              role="tab"
              id="reports-all-tab"
              aria-controls="reports-list-panel"
              aria-selected={filter === "ALL"}
              className={filter === "ALL" ? "selected" : ""}
              onClick={() => setFilter("ALL")}
            >
              {t("all")} <span>{filterCounts.ALL}</span>
            </button>
            <button
              type="button"
              role="tab"
              id="reports-review-tab"
              aria-controls="reports-list-panel"
              aria-selected={filter === "IN_REVIEW"}
              className={filter === "IN_REVIEW" ? "selected" : ""}
              onClick={() => setFilter("IN_REVIEW")}
            >
              {t("inReview")} <span>{filterCounts.IN_REVIEW}</span>
            </button>
            <button
              type="button"
              role="tab"
              id="reports-addressed-tab"
              aria-controls="reports-list-panel"
              aria-selected={filter === "ADDRESSED"}
              className={filter === "ADDRESSED" ? "selected" : ""}
              onClick={() => setFilter("ADDRESSED")}
            >
              {t("addressed")} <span>{filterCounts.ADDRESSED}</span>
            </button>
          </div>
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
        </div>
        <div className="report-list-heading">
          <div>
            <span className="eyebrow">{filterLabel(filter)}</span>
            <strong>
              {visible.length} {t("reportsFound")}
            </strong>
          </div>
          <span>{t("reportListHint")}</span>
        </div>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div
        className="report-list"
        id="reports-list-panel"
        role="tabpanel"
        aria-labelledby={`reports-${filter === "ALL" ? "all" : filter === "IN_REVIEW" ? "review" : "addressed"}-tab`}
      >
        {loading ? (
          <div className="empty-state">
            <Spinner /> {t("loading")}
          </div>
        ) : visible.length ? (
          visible.map((report) => (
            <button
              type="button"
              className="report-row"
              key={report.id}
              onClick={() => setSelected(report)}
              aria-label={`${t("viewDetails")}: ${report.title}`}
            >
              <div className="report-row-main">
                <div className="report-row-top">
                  <div className="report-row-identity">
                    <span
                      className={`priority-dot priority-${report.priority.toLowerCase()}`}
                      aria-hidden="true"
                    />
                    <span className="report-code">
                      REP-{String(report.id).padStart(6, "0")}
                    </span>
                    <span className="report-category">
                      {categoryLabel(report.category)}
                    </span>
                  </div>
                  <span
                    className={`priority-tag priority-${report.priority.toLowerCase()}`}
                  >
                    {priorityLabel(report.priority)}
                  </span>
                </div>
                <h3>{report.title}</h3>
                <p className="report-row-summary">{report.description}</p>
                <div className="report-row-meta">
                  <span>
                    {report.anonymous
                      ? `⌁ ${t("confidential")}`
                      : `${t("reporter")}: ${report.reporterDisplayName ?? "—"}`}
                  </span>
                  <time dateTime={report.createdAt}>
                    {formatDate(report.createdAt)}
                  </time>
                </div>
              </div>
              <div className="report-row-footer">
                <span
                  className={`status-tag status-${report.status.toLowerCase()}`}
                >
                  {statusLabel(report.status)}
                </span>
                <span className="report-row-action">
                  {t("viewDetails")} <span aria-hidden="true">→</span>
                </span>
              </div>
            </button>
          ))
        ) : (
          <div className="empty-state">
            <h3>{t("noReports")}</h3>
          </div>
        )}
      </div>
      {selected && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="modal-card report-detail"
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-detail-title"
          >
            <button
              type="button"
              className="modal-close"
              onClick={() => setSelected(null)}
              aria-label={t("close")}
            >
              ×
            </button>
            <div className="report-detail-header">
              <div>
                <span className="eyebrow">
                  REP-{String(selected.id).padStart(6, "0")}
                </span>
                <h2 id="report-detail-title">{selected.title}</h2>
              </div>
              <span
                className={`status-tag status-${selected.status.toLowerCase()}`}
              >
                {statusLabel(selected.status)}
              </span>
            </div>
            <div className="detail-grid">
              <span>{t("category")}</span>
              <strong>{categoryLabel(selected.category)}</strong>
              <span>{t("priority")}</span>
              <strong>{priorityLabel(selected.priority)}</strong>
              <span>{t("reporter")}</span>
              <strong>
                {selected.anonymous
                  ? t("confidential")
                  : selected.reporterDisplayName}
              </strong>
              <span>{t("createdDate")}</span>
              <strong>{formatDate(selected.createdAt)}</strong>
            </div>
            <div className="detail-description">
              <span className="eyebrow">{t("description")}</span>
              <p>{selected.description}</p>
            </div>
            <label>
              {t("changeStatus")}
              <select
                value={selected.status}
                onChange={(event) =>
                  void changeStatus(
                    selected.id,
                    event.target.value as ReportStatus,
                  )
                }
              >
                <option value="NEW">{t("reportStatusNew")}</option>
                <option value="IN_REVIEW">{t("reportStatusInReview")}</option>
                <option value="ADDRESSED">{t("reportStatusAddressed")}</option>
                <option value="CLOSED">{t("reportStatusClosed")}</option>
              </select>
            </label>
          </section>
        </div>
      )}
    </section>
  );
}
