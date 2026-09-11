import { useEffect, useRef, useState } from "react";
import type {
  AiConversation,
  AiMessage,
  Language,
} from "../../../domain/types";
import { useLanguage } from "../../../i18n/LanguageProvider";
import {
  createConversation,
  deleteConversation,
  getConversations,
  getMessages,
  renameConversation,
  sendMessage,
} from "../../../infrastructure/ai/aiService";
import { isUnauthorized } from "../../../infrastructure/api/apiClient";
import { Spinner } from "../../../shared/ui/Spinner";

export function EmployeeAiPage({
  token,
  language,
  onUnauthorized,
}: {
  token: string;
  language: Language;
  onUnauthorized: () => void;
}) {
  const { t } = useLanguage();
  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [active, setActive] = useState<AiConversation | null>(null);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [renameId, setRenameId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const chatWindowRef = useRef<HTMLDivElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    getConversations(token)
      .then(setConversations)
      .catch((errorValue: unknown) => {
        if (isUnauthorized(errorValue)) onUnauthorized();
        else setError(t("errorGeneric"));
      })
      .finally(() => setLoading(false));
  }, [onUnauthorized, t, token]);
  useEffect(() => {
    const chatWindow = chatWindowRef.current;
    const chatEnd = chatEndRef.current;
    if (!chatWindow || !chatEnd) return;

    const frameId = window.requestAnimationFrame(() => {
      chatEnd.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [messages, pending]);

  async function openConversation(conversation: AiConversation) {
    setActive(conversation);
    setError("");
    try {
      setMessages(await getMessages(token, conversation.id));
    } catch (errorValue) {
      if (isUnauthorized(errorValue)) onUnauthorized();
      else setError(t("errorGeneric"));
    }
  }
  async function createNewConversation() {
    setError("");
    try {
      const conversation = await createConversation(token);
      setConversations((current) => [conversation, ...current]);
      setActive(conversation);
      setMessages([]);
    } catch (errorValue) {
      if (isUnauthorized(errorValue)) onUnauthorized();
      else setError(t("errorGeneric"));
    }
  }
  async function submitMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!active || !draft.trim() || pending) return;
    const content = draft.trim();
    setDraft("");
    setPending(true);
    setError("");
    const optimisticMessage: AiMessage = {
      id: -Date.now(),
      sender: "USER",
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((current) => [...current, optimisticMessage]);
    try {
      setMessages(await sendMessage(token, active.id, content, language));
    } catch (errorValue) {
      if (isUnauthorized(errorValue)) onUnauthorized();
      else setError(t("assistantUnavailable"));
    } finally {
      setPending(false);
    }
  }
  async function saveRename(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!renameId || !renameValue.trim()) return;
    try {
      const updated = await renameConversation(token, renameId, renameValue);
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === updated.id ? updated : conversation,
        ),
      );
      setActive((current) => (current?.id === updated.id ? updated : current));
      setRenameId(null);
    } catch (errorValue) {
      if (isUnauthorized(errorValue)) onUnauthorized();
      else setError(t("errorGeneric"));
    }
  }
  async function confirmDelete() {
    if (!deleteId) return;
    try {
      await deleteConversation(token, deleteId);
      setConversations((current) =>
        current.filter((conversation) => conversation.id !== deleteId),
      );
      if (active?.id === deleteId) {
        setActive(null);
        setMessages([]);
      }
      setDeleteId(null);
    } catch (errorValue) {
      if (isUnauthorized(errorValue)) onUnauthorized();
      else setError(t("errorGeneric"));
    }
  }

  if (loading)
    return (
      <section className="content-stack">
        <div className="empty-state">
          <Spinner /> {t("loading")}
        </div>
      </section>
    );
  if (!active)
    return (
      <section className="content-stack ai-page ai-history-page">
        <div className="ai-page-heading">
          <div className="ai-heading-copy">
            <div>
              <span className="eyebrow">{t("privateSupport")}</span>
              <h2>{t("chatHistory")}</h2>
              <p>{t("chatIntro")}</p>
            </div>
          </div>
          <button
            type="button"
            className="primary-button ai-new-button"
            onClick={() => void createNewConversation()}
          >
            {t("newConversation")}
          </button>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {conversations.length ? (
          <div className="conversation-list">
            {conversations.map((conversation) => (
              <div className="conversation-row" key={conversation.id}>
                <button
                  type="button"
                  className="conversation-open"
                  onClick={() => void openConversation(conversation)}
                >
                  <strong>{conversation.title}</strong>
                </button>
                <div className="conversation-actions">
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => {
                      setRenameId(conversation.id);
                      setRenameValue(conversation.title);
                    }}
                    aria-label={t("rename")}
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    className="icon-button danger"
                    onClick={() => setDeleteId(conversation.id)}
                    aria-label={t("delete")}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="ai-empty">
            <span className="ai-empty-mark" aria-hidden="true">
              ✦
            </span>
            <h3>{t("noConversations")}</h3>
            <p>{t("chatIntro")}</p>
          </div>
        )}
        {(renameId || deleteId) && (
          <AiDialog
            renameId={renameId}
            renameValue={renameValue}
            setRenameValue={setRenameValue}
            onRename={saveRename}
            onCancel={() => {
              setRenameId(null);
              setDeleteId(null);
            }}
            onDelete={() => void confirmDelete()}
          />
        )}
      </section>
    );

  return (
    <section className="content-stack ai-page ai-conversation-page">
      <div className="ai-toolbar">
        <button
          type="button"
          className="secondary-button ai-back-button"
          onClick={() => {
            setActive(null);
            setMessages([]);
          }}
        >
          ← {t("back")}
        </button>
        <div className="ai-toolbar-main">
          <div className="ai-heading-copy">
            <div>
              <span className="eyebrow">{t("privateSupport")}</span>
              <h2>{active.title}</h2>
            </div>
          </div>
          <div className="conversation-actions">
            <button
              type="button"
              className="icon-button"
              onClick={() => {
                setRenameId(active.id);
                setRenameValue(active.title);
              }}
              aria-label={t("rename")}
            >
              ✎
            </button>
            <button
              type="button"
              className="icon-button danger"
              onClick={() => setDeleteId(active.id)}
              aria-label={t("delete")}
            >
              ×
            </button>
          </div>
        </div>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div
        className="chat-window"
        ref={chatWindowRef}
        aria-live="polite"
        aria-busy={pending}
        tabIndex={0}
      >
        {messages.length ? (
          messages.map((message) => (
            <div
              className={`chat-message ${message.sender === "USER" ? "user" : "assistant"}`}
              key={message.id}
            >
              <p>{message.content}</p>
            </div>
          ))
        ) : (
          <div className="chat-empty">
            <span className="ai-empty-mark" aria-hidden="true">
              ✦
            </span>
            <p>{t("chatIntro")}</p>
          </div>
        )}
        {pending && (
          <div
            className="chat-message assistant typing"
            aria-label={t("aiThinking")}
            role="status"
          >
            <span aria-hidden="true">•</span>
            <span aria-hidden="true">•</span>
            <span aria-hidden="true">•</span>
          </div>
        )}
        <div
          className="chat-scroll-anchor"
          ref={chatEndRef}
          aria-hidden="true"
        />
      </div>
      <form className="chat-composer" onSubmit={submitMessage}>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={1}
          maxLength={4000}
          placeholder={t("messagePlaceholder")}
          disabled={pending}
        />
        <button
          type="submit"
          className="primary-button send-button"
          disabled={pending || !draft.trim()}
          aria-label={t("send")}
        >
          {pending ? <Spinner /> : "→"}
        </button>
      </form>
      <p className="ai-disclaimer">{t("aiDisclaimer")}</p>
      {(renameId || deleteId) && (
        <AiDialog
          renameId={renameId}
          renameValue={renameValue}
          setRenameValue={setRenameValue}
          onRename={saveRename}
          onCancel={() => {
            setRenameId(null);
            setDeleteId(null);
          }}
          onDelete={() => void confirmDelete()}
        />
      )}
    </section>
  );
}

function AiDialog({
  renameId,
  renameValue,
  setRenameValue,
  onRename,
  onCancel,
  onDelete,
}: {
  renameId: number | null;
  renameValue: string;
  setRenameValue: (value: string) => void;
  onRename: (event: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const { t } = useLanguage();
  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal-card" role="dialog" aria-modal="true">
        {renameId ? (
          <form onSubmit={onRename}>
            <span className="eyebrow">{t("ai")}</span>
            <h2>{t("rename")}</h2>
            <label>
              {t("title")}
              <input
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
                required
                maxLength={160}
                autoFocus
              />
            </label>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={onCancel}
              >
                {t("cancel")}
              </button>
              <button type="submit" className="primary-button">
                {t("saveChanges")}
              </button>
            </div>
          </form>
        ) : (
          <>
            <span className="eyebrow">{t("ai")}</span>
            <h2>{t("confirmDelete")}</h2>
            <p className="form-intro">{t("confirmDeleteText")}</p>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={onCancel}
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                className="primary-button danger-button"
                onClick={onDelete}
              >
                {t("delete")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
