import { describe, it, expect, vi } from "vitest";
import { HrReportsPage } from "../src/contexts/report/presentation/HrReportsPage";
import {
  mount,
  button,
  field,
  change,
  screen,
  waitFor,
  fireEvent,
  network,
  response,
  token,
  report,
  deferred,
  t,
} from "./helpers";
async function reports(extra: Record<string, any> = {}) {
  const net = network({ "GET /api/v1/reports": [report], ...extra });
  const onUnauthorized = vi.fn();
  const view = mount(
    <HrReportsPage token={token} onUnauthorized={onUnauthorized} />,
  );
  await screen.findByRole("button", { name: new RegExp(report.title) });
  return { ...net, ...view, onUnauthorized };
}
function open() {
  fireEvent.click(
    screen.getByRole("button", { name: new RegExp(report.title) }),
  );
}
describe("src/contexts/report/presentation/HrReportsPage.tsx | integration", () => {
  it.each(["NEW", "IN_REVIEW", "ADDRESSED", "CLOSED"])(
    "status %s persisted into row and detail",
    async (status) => {
      const net = await reports({
        "PATCH /api/v1/reports/6/status": { ...report, status },
      });
      open();
      change(field("changeStatus"), status);
      await waitFor(() => expect(field("changeStatus")).toHaveValue(status));
      await waitFor(() => expect(net.mutations()).toHaveLength(1));
      expect(net.mutations()[0].body).toEqual({ status });
    },
  );
  it.each([401, 403, 422, 500])(
    "status failure %i preserves existing state",
    async (status) => {
      const net = await reports({
        "PATCH /api/v1/reports/6/status": response(
          { message: "failure" },
          status,
        ),
      });
      open();
      change(field("changeStatus"), "CLOSED");
      if (status === 401 || status === 403)
        await waitFor(() => expect(net.onUnauthorized).toHaveBeenCalledOnce());
      else await screen.findByRole("alert");
      expect(field("changeStatus")).toHaveValue("NEW");
    },
  );
  it.each([401, 403, 400, 500])(
    "initial list failure %i routes auth or safe error",
    async (status) => {
      network({
        "GET /api/v1/reports": response({ message: "failure" }, status),
      });
      const onUnauthorized = vi.fn();
      mount(<HrReportsPage token={token} onUnauthorized={onUnauthorized} />);
      if (status === 401 || status === 403)
        await waitFor(() => expect(onUnauthorized).toHaveBeenCalledOnce());
      else
        expect(await screen.findByRole("alert")).toHaveTextContent(
          t.errorGeneric,
        );
    },
  );
  it("anonymous report hides identity in row and detail", async () => {
    await reports({
      "GET /api/v1/reports": [
        { ...report, reporter_display_name: "Private identity" },
      ],
    });
    expect(screen.queryByText(/Private identity/)).toBeNull();
    open();
    expect(screen.queryByText(/Private identity/)).toBeNull();
    expect(screen.getAllByText(t.confidential).length).toBeGreaterThan(0);
  });
  it("identified report preserves attributed author", async () => {
    await reports({
      "GET /api/v1/reports": [
        { ...report, anonymous: false, reporter_display_name: "Named author" },
      ],
    });
    expect(screen.getByText(/Named author/)).toBeInTheDocument();
    open();
    expect(screen.getByRole("dialog")).toHaveTextContent("Named author");
  });
  it.each([
    ["inReview", "IN_REVIEW"],
    ["addressed", "ADDRESSED"],
  ] as const)("filter %s matches data status", async (key, status) => {
    await reports({
      "GET /api/v1/reports": [
        report,
        { ...report, id: 8, title: "Matching", status },
      ],
    });
    fireEvent.click(screen.getByRole("tab", { name: new RegExp(t[key]) }));
    expect(
      screen.queryByRole("button", { name: new RegExp(report.title) }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: /Matching/ }),
    ).toBeInTheDocument();
  });
  it("background refresh updates selected record", async () => {
    let count = 0;
    await reports({
      "GET /api/v1/reports": () =>
        ++count === 1 ? [report] : [{ ...report, status: "IN_REVIEW" }],
    });
    open();
    fireEvent.focus(window);
    await waitFor(() => expect(field("changeStatus")).toHaveValue("IN_REVIEW"));
  });
  it("background deletion closes stale selected record", async () => {
    let count = 0;
    await reports({
      "GET /api/v1/reports": () => (++count === 1 ? [report] : []),
    });
    open();
    fireEvent.focus(window);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
  it("foreground pending prevents duplicate refresh", async () => {
    const pending = deferred<unknown>();
    let count = 0;
    const net = await reports({
      "GET /api/v1/reports": () => (++count === 1 ? [report] : pending.promise),
    });
    fireEvent.click(button("refresh"));
    fireEvent.click(button("refresh"));
    fireEvent.focus(window);
    expect(net.calls).toHaveLength(2);
    pending.resolve([report]);
    await waitFor(() => expect(button("refresh")).toBeEnabled());
  });
  it("closing detail does not mutate report", async () => {
    const net = await reports();
    open();
    fireEvent.click(button("close"));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(net.mutations()).toHaveLength(0);
  });
});
