import { useEffect, useRef } from "react";

type SuccessMessageProps = {
  message: string;
  onDismiss: () => void;
  durationMs?: number;
};

export function SuccessMessage({
  message,
  onDismiss,
  durationMs = 5000,
}: SuccessMessageProps) {
  const dismissRef = useRef(onDismiss);

  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!message) return;

    const timeoutId = window.setTimeout(() => {
      dismissRef.current();
    }, durationMs);

    return () => window.clearTimeout(timeoutId);
  }, [durationMs, message]);

  if (!message) return null;

  return (
    <p className="success-message" role="status" aria-live="polite">
      {message}
    </p>
  );
}
