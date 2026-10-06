import { describe, it, expect, vi } from "vitest";
import { act } from "@testing-library/react";
import { HrHomePage } from "../src/contexts/humanresources/presentation/HrHomePage";
import {
  mount,
  screen,
  waitFor,
  fireEvent,
  network,
  response,
  token,
  deferred,
  t,
} from "./helpers";
const summary = {
  date: "2026-01-01",
  total_responses: 10,
  distribution: { GOOD: 5, BAD: 5 },
  active_employees: 20,
  response_rate: 50,
};
async function hr(extra: Record<string, any> = {}) {
  const net = network({ "GET /api/v1/mood/summary": summary, ...extra });
  const onUnauthorized = vi.fn();
  const view = mount(
    <HrHomePage
      token={token}
      displayName="Ana"
      onUnauthorized={onUnauthorized}
    />,
  );
  await screen.findByText(`10 ${t.response}`);
  return { ...net, ...view, onUnauthorized };
}
describe("src/contexts/humanresources/presentation/HrHomePage.tsx | integration", () => {
  it.each([401, 403, 400, 500])(
    "initial summary failure %i uses auth or generic fallback",
    async (status) => {
      network({
        "GET /api/v1/mood/summary": response({ message: "failure" }, status),
      });
      const onUnauthorized = vi.fn();
      mount(
        <HrHomePage
          token={token}
          displayName="Ana"
          onUnauthorized={onUnauthorized}
        />,
      );
      if (status === 401 || status === 403)
        await waitFor(() => expect(onUnauthorized).toHaveBeenCalledOnce());
      else
        expect(await screen.findByRole("alert")).toHaveTextContent(
          t.errorGeneric,
        );
    },
  );
  it.each([401, 403, 400, 500])(
    "background summary failure %i keeps previous metrics",
    async (status) => {
      let count = 0;
      const net = await hr({
        "GET /api/v1/mood/summary": () =>
          ++count === 1 ? summary : response({ message: "failure" }, status),
      });
      fireEvent.focus(window);
      if (status === 401 || status === 403)
        await waitFor(() => expect(net.onUnauthorized).toHaveBeenCalledOnce());
      else await screen.findByRole("alert");
      expect(screen.getByText(`10 ${t.response}`)).toBeInTheDocument();
    },
  );
  it("focus retry recovers failed initial summary", async () => {
    let count = 0;
    network({
      "GET /api/v1/mood/summary": () =>
        ++count === 1 ? response({ message: "failure" }, 500) : summary,
    });
    mount(
      <HrHomePage token={token} displayName="Ana" onUnauthorized={vi.fn()} />,
    );
    await screen.findByRole("alert");
    fireEvent.focus(window);
    await screen.findByText(`10 ${t.response}`);
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("deduplicates simultaneous focus refreshes", async () => {
    const pending = deferred<unknown>();
    let count = 0;
    const net = await hr({
      "GET /api/v1/mood/summary": () =>
        ++count === 1 ? summary : pending.promise,
    });
    fireEvent.focus(window);
    fireEvent.focus(window);
    await waitFor(() => expect(net.calls).toHaveLength(2));
    pending.resolve(summary);
    await act(async () => {});
  });
  it("pending initial request prevents background duplicate", async () => {
    const pending = deferred<unknown>();
    const net = network({ "GET /api/v1/mood/summary": () => pending.promise });
    mount(
      <HrHomePage token={token} displayName="Ana" onUnauthorized={vi.fn()} />,
    );
    fireEvent.focus(window);
    await act(async () => {});
    expect(net.calls).toHaveLength(1);
    pending.resolve(summary);
    await screen.findByText(`10 ${t.response}`);
  });
  it("hidden tab interval never requests new summary", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    const net = await hr();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });
    expect(net.calls).toHaveLength(1);
  });
  it("visible interval refreshes exactly at 30 seconds", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    const net = await hr();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(29999);
    });
    expect(net.calls).toHaveLength(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(net.calls).toHaveLength(2);
  });
  it("focus refresh updates saved metrics", async () => {
    let count = 0;
    await hr({
      "GET /api/v1/mood/summary": () =>
        ++count === 1 ? summary : { ...summary, total_responses: 12 },
    });
    fireEvent.focus(window);
    await screen.findByText(`12 ${t.response}`);
  });
  it("visibility return requests new metrics", async () => {
    const net = await hr();
    fireEvent(document, new Event("visibilitychange"));
    await waitFor(() => expect(net.calls).toHaveLength(2));
  });
  it("unmounted summary has no refresh listeners", async () => {
    const net = await hr();
    net.unmount();
    fireEvent.focus(window);
    fireEvent(document, new Event("visibilitychange"));
    await act(async () => {});
    expect(net.calls).toHaveLength(1);
  });
  it("new token is used after rerender", async () => {
    const net = await hr();
    net.rerender(
      <HrHomePage
        token="next-test-token"
        displayName="Ana"
        onUnauthorized={net.onUnauthorized}
      />,
    );
    await waitFor(() =>
      expect(
        net.calls.some(
          (c) => c.headers.Authorization === "Bearer next-test-token",
        ),
      ).toBe(true),
    );
  });
  it("empty distribution has finite zero positive rate", async () => {
    network({
      "GET /api/v1/mood/summary": {
        ...summary,
        distribution: {},
        total_responses: 0,
      },
    });
    const view = mount(
      <HrHomePage token={token} displayName="Ana" onUnauthorized={vi.fn()} />,
    );
    await screen.findByText(`0 ${t.response}`);
    expect(view.container.querySelector(".donut strong")).toHaveTextContent(
      "0%",
    );
    expect(view.container).not.toHaveTextContent("NaN");
  });
  it("omitted mood categories contribute zero", async () => {
    network({
      "GET /api/v1/mood/summary": { ...summary, distribution: { BAD: 10 } },
    });
    const view = mount(
      <HrHomePage token={token} displayName="Ana" onUnauthorized={vi.fn()} />,
    );
    await screen.findByText(`10 ${t.response}`);
    expect(view.container.querySelector(".donut strong")).toHaveTextContent(
      "0%",
    );
    expect(
      view.container.querySelectorAll(".legend-row strong")[0],
    ).toHaveTextContent("0");
  });
  it("pending background load preserves previous metrics", async () => {
    const pending = deferred<unknown>();
    let count = 0;
    const net = await hr({
      "GET /api/v1/mood/summary": () =>
        ++count === 1 ? summary : pending.promise,
    });
    fireEvent.focus(window);
    await waitFor(() => expect(net.calls).toHaveLength(2));
    expect(screen.getByText(`10 ${t.response}`)).toBeInTheDocument();
    pending.resolve({ ...summary, total_responses: 11 });
    await screen.findByText(`11 ${t.response}`);
  });
});
