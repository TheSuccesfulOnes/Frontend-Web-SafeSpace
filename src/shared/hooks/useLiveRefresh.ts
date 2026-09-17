import { useCallback, useEffect, useRef } from "react";

type RefreshCallback = () => void | Promise<void>;

const DEFAULT_REFRESH_INTERVAL_MS = 30_000;

/**
 * Revalidates a mounted page while it is visible and when the user returns to it.
 * The callback is kept in a ref so callers can safely provide functions that use
 * the current token and translations without recreating the interval.
 */
export function useLiveRefresh(
  refresh: RefreshCallback,
  intervalMs = DEFAULT_REFRESH_INTERVAL_MS,
) {
  const refreshRef = useRef<RefreshCallback>(refresh);
  const refreshingRef = useRef(false);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  const runRefresh = useCallback(() => {
    if (refreshingRef.current) return;

    refreshingRef.current = true;
    void Promise.resolve()
      .then(() => refreshRef.current())
      .catch(() => undefined)
      .finally(() => {
        refreshingRef.current = false;
      });
  }, []);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") runRefresh();
    };

    const intervalId = window.setInterval(refreshWhenVisible, intervalMs);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("focus", runRefresh);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("focus", runRefresh);
    };
  }, [intervalMs, runRefresh]);
}
