import { describe, it, expect, vi } from "vitest";
import { renderHook, act, fireEvent } from "@testing-library/react";
import { useLiveRefresh } from "../src/shared/hooks/useLiveRefresh";
import { deferred } from "./helpers";
async function flush() {
  await act(async () => {});
}
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}
function hook(refresh = vi.fn(), interval?: number) {
  vi.useFakeTimers();
  return { refresh, ...renderHook(() => useLiveRefresh(refresh, interval)) };
}
describe("src/shared/hooks/useLiveRefresh.ts | integration", () => {
  it("mount does not eagerly duplicate caller's initial request", async () => {
    const h = hook();
    await flush();
    expect(h.refresh).not.toHaveBeenCalled();
  });
  it("default interval has no request before boundary", async () => {
    const h = hook();
    await advance(29999);
    expect(h.refresh).not.toHaveBeenCalled();
  });
  it("default interval triggers at boundary", async () => {
    const h = hook();
    await advance(30000);
    expect(h.refresh).toHaveBeenCalledOnce();
  });
  it("custom interval replaces default", async () => {
    const h = hook(vi.fn(), 1000);
    await advance(999);
    expect(h.refresh).not.toHaveBeenCalled();
    await advance(1);
    expect(h.refresh).toHaveBeenCalledOnce();
  });
  it("interval repeats once per completed cycle", async () => {
    const h = hook();
    await advance(90000);
    expect(h.refresh).toHaveBeenCalledTimes(3);
  });
  it("hidden document skips interval", async () => {
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    const h = hook();
    await advance(60000);
    expect(h.refresh).not.toHaveBeenCalled();
  });
  it("hidden visibility event skips refresh", async () => {
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    const h = hook();
    fireEvent(document, new Event("visibilitychange"));
    await flush();
    expect(h.refresh).not.toHaveBeenCalled();
  });
  it("visible return refreshes immediately", async () => {
    const visibility = vi
      .spyOn(document, "visibilityState", "get")
      .mockReturnValue("hidden");
    const h = hook();
    await advance(30000);
    visibility.mockReturnValue("visible");
    fireEvent(document, new Event("visibilitychange"));
    await flush();
    expect(h.refresh).toHaveBeenCalledOnce();
  });
  it("focus requests immediate refresh", async () => {
    const h = hook();
    fireEvent.focus(window);
    await flush();
    expect(h.refresh).toHaveBeenCalledOnce();
  });
  it("focus remains an explicit refresh even with hidden visibility", async () => {
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    const h = hook();
    fireEvent.focus(window);
    await flush();
    expect(h.refresh).toHaveBeenCalledOnce();
  });
  it("simultaneous focus events deduplicate pending work", async () => {
    const pending = deferred<void>();
    const h = hook(vi.fn(() => pending.promise));
    fireEvent.focus(window);
    fireEvent.focus(window);
    await flush();
    expect(h.refresh).toHaveBeenCalledOnce();
    pending.resolve();
    await flush();
  });
  it("pending refresh deduplicates interval events", async () => {
    const pending = deferred<void>();
    const h = hook(vi.fn(() => pending.promise));
    await advance(90000);
    expect(h.refresh).toHaveBeenCalledOnce();
    pending.resolve();
    await flush();
  });
  it("pending focus also deduplicates visibility event", async () => {
    const pending = deferred<void>();
    const h = hook(vi.fn(() => pending.promise));
    fireEvent.focus(window);
    fireEvent(document, new Event("visibilitychange"));
    await flush();
    expect(h.refresh).toHaveBeenCalledOnce();
    pending.resolve();
    await flush();
  });
  it("successful promise unlocks subsequent focus", async () => {
    const h = hook(vi.fn().mockResolvedValue(undefined));
    fireEvent.focus(window);
    await flush();
    fireEvent.focus(window);
    await flush();
    expect(h.refresh).toHaveBeenCalledTimes(2);
  });
  it("rejected promise is contained and allows retry", async () => {
    const h = hook(vi.fn().mockRejectedValue(new Error("offline")));
    fireEvent.focus(window);
    await flush();
    fireEvent.focus(window);
    await flush();
    expect(h.refresh).toHaveBeenCalledTimes(2);
  });
  it("synchronous callback throw is contained and allows retry", async () => {
    const h = hook(
      vi.fn(() => {
        throw new Error("offline");
      }),
    );
    fireEvent.focus(window);
    await flush();
    fireEvent.focus(window);
    await flush();
    expect(h.refresh).toHaveBeenCalledTimes(2);
  });
  it("rerender uses latest callback without resetting interval", async () => {
    vi.useFakeTimers();
    const first = vi.fn(),
      next = vi.fn();
    const view = renderHook(({ callback }) => useLiveRefresh(callback), {
      initialProps: { callback: first },
    });
    await advance(15000);
    view.rerender({ callback: next });
    await advance(15000);
    expect(first).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
  });
  it("changing interval removes old interval", async () => {
    vi.useFakeTimers();
    const refresh = vi.fn();
    const view = renderHook(
      ({ interval }) => useLiveRefresh(refresh, interval),
      { initialProps: { interval: 1000 } },
    );
    view.rerender({ interval: 5000 });
    await advance(4999);
    expect(refresh).not.toHaveBeenCalled();
    await advance(1);
    expect(refresh).toHaveBeenCalledOnce();
  });
  it("unmount removes all refresh triggers", async () => {
    const h = hook();
    h.unmount();
    fireEvent.focus(window);
    fireEvent(document, new Event("visibilitychange"));
    await advance(90000);
    expect(h.refresh).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("multiple instances maintain independent pending guards", async () => {
    const pending = deferred<void>();
    const first = hook(vi.fn(() => pending.promise));
    const nextRefresh = vi.fn();
    renderHook(() => useLiveRefresh(nextRefresh));
    fireEvent.focus(window);
    await flush();
    fireEvent.focus(window);
    await flush();
    expect(first.refresh).toHaveBeenCalledOnce();
    expect(nextRefresh).toHaveBeenCalledTimes(2);
    pending.resolve();
    await flush();
  });
});
