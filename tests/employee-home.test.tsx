import { describe, it, expect, vi } from "vitest";
import { EmployeeHomePage } from "../src/contexts/employee/presentation/EmployeeHomePage";
import {
  mount,
  button,
  screen,
  waitFor,
  fireEvent,
  network,
  response,
  token,
  deferred,
  t,
} from "./helpers";
const moods = [
  ["VERY_BAD", "veryBad"],
  ["BAD", "bad"],
  ["GOOD", "good"],
  ["VERY_GOOD", "veryGood"],
] as const;
async function home(extra: Record<string, any> = {}) {
  const net = network({ "GET /api/v1/mood/today": null, ...extra });
  const onUnauthorized = vi.fn();
  mount(
    <EmployeeHomePage
      token={token}
      displayName="Ana"
      onUnauthorized={onUnauthorized}
    />,
  );
  await waitFor(() => expect(button("good")).toBeEnabled());
  return { ...net, onUnauthorized };
}
describe("src/contexts/employee/presentation/EmployeeHomePage.tsx | integration", () => {
  it.each(moods)(
    "saves mood %s and prevents further daily submissions",
    async (mood, key) => {
      const net = await home({
        "POST /api/v1/mood/today": { mood, date: "2026-01-01" },
      });
      fireEvent.click(button(key));
      await waitFor(() =>
        expect(button(key)).toHaveAttribute("aria-pressed", "true"),
      );
      for (const [, other] of moods) {
        expect(button(other)).toBeDisabled();
        fireEvent.click(button(other));
      }
      expect(net.mutations()).toHaveLength(1);
      expect(net.mutations()[0].body).toEqual({ mood });
    },
  );
  it.each(moods)(
    "persisted %s locks all moods on reload",
    async (mood, key) => {
      const net = network({
        "GET /api/v1/mood/today": { mood, date: "2026-01-01" },
      });
      mount(
        <EmployeeHomePage
          token={token}
          displayName="Ana"
          onUnauthorized={vi.fn()}
        />,
      );
      await waitFor(() =>
        expect(button(key)).toHaveAttribute("aria-pressed", "true"),
      );
      for (const [, other] of moods) {
        fireEvent.click(button(other));
        expect(button(other)).toBeDisabled();
      }
      expect(net.mutations()).toHaveLength(0);
    },
  );
  it.each([400, 401, 403, 500])(
    "initial mood error %i routes authorization or unavailable notice",
    async (status) => {
      network({
        "GET /api/v1/mood/today": response({ message: "failure" }, status),
      });
      const onUnauthorized = vi.fn();
      mount(
        <EmployeeHomePage
          token={token}
          displayName="Ana"
          onUnauthorized={onUnauthorized}
        />,
      );
      if (status === 401 || status === 403)
        await waitFor(() => expect(onUnauthorized).toHaveBeenCalledOnce());
      else
        expect(await screen.findByRole("alert")).toHaveTextContent(
          t.moodUnavailable,
        );
    },
  );
  it.each([400, 401, 403, 500])(
    "submit failure %i unlocks daily choices",
    async (status) => {
      const net = await home({
        "POST /api/v1/mood/today": response({ message: "failure" }, status),
      });
      fireEvent.click(button("good"));
      if (status === 401 || status === 403)
        await waitFor(() => expect(net.onUnauthorized).toHaveBeenCalledOnce());
      else await screen.findByRole("alert");
      await waitFor(() => expect(button("good")).toBeEnabled());
      expect(button("good")).toHaveAttribute("aria-pressed", "false");
    },
  );
  it("initial request locks mood selection", async () => {
    const pending = deferred<unknown>();
    const net = network({ "GET /api/v1/mood/today": () => pending.promise });
    mount(
      <EmployeeHomePage
        token={token}
        displayName="Ana"
        onUnauthorized={vi.fn()}
      />,
    );
    for (const [, key] of moods) {
      expect(button(key)).toBeDisabled();
      fireEvent.click(button(key));
    }
    expect(net.mutations()).toHaveLength(0);
    pending.resolve(null);
    await waitFor(() => expect(button("good")).toBeEnabled());
  });
  it("pending mood locks all choices and sends one mutation", async () => {
    const pending = deferred<unknown>();
    const net = await home({
      "POST /api/v1/mood/today": () => pending.promise,
    });
    fireEvent.click(button("good"));
    for (const [, key] of moods) {
      expect(button(key)).toBeDisabled();
      fireEvent.click(button(key));
    }
    expect(net.mutations()).toHaveLength(1);
    pending.resolve({ mood: "GOOD", date: "2026-01-01" });
    await waitFor(() =>
      expect(button("good")).toHaveAttribute("aria-pressed", "true"),
    );
  });
  it("failed mutation can retry a different mood", async () => {
    let n = 0;
    const net = await home({
      "POST /api/v1/mood/today": () =>
        ++n === 1
          ? response({ message: "failure" }, 503)
          : { mood: "BAD", date: "2026-01-01" },
    });
    fireEvent.click(button("good"));
    await screen.findByRole("alert");
    fireEvent.click(button("bad"));
    await waitFor(() =>
      expect(button("bad")).toHaveAttribute("aria-pressed", "true"),
    );
    expect(net.mutations()).toHaveLength(2);
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("both mood read and write carry the current bearer", async () => {
    const net = await home({
      "POST /api/v1/mood/today": { mood: "GOOD", date: "2026-01-01" },
    });
    fireEvent.click(button("good"));
    await waitFor(() => expect(net.mutations()).toHaveLength(1));
    expect(
      net.calls.every((c) => c.headers.Authorization === `Bearer ${token}`),
    ).toBe(true);
  });
});
