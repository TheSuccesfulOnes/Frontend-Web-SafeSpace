import { describe, it, expect, vi } from "vitest";
import { EmployeeSurveysPage } from "../src/contexts/survey/presentation/EmployeeSurveysPage";
import {
  mount,
  button,
  field,
  change,
  submit,
  screen,
  waitFor,
  fireEvent,
  network,
  response,
  token,
  survey,
  activity,
  comment,
  report,
  deferred,
  t,
} from "./helpers";
async function page(extra: Record<string, any> = {}) {
  const net = network({
    "GET /api/v1/surveys": [survey],
    "GET /api/v1/activities": [activity],
    "GET /api/v1/surveys/1/comments": [comment],
    "GET /api/v1/reports/mine": [],
    ...extra,
  });
  const onUnauthorized = vi.fn();
  const view = mount(
    <EmployeeSurveysPage token={token} onUnauthorized={onUnauthorized} />,
  );
  await waitFor(() => expect(button("refresh")).toBeEnabled());
  return { ...net, ...view, onUnauthorized };
}
async function comments(extra: Record<string, any> = {}) {
  const net = await page(extra);
  fireEvent.click(
    screen.getByRole("button", { name: new RegExp(t.showComments) }),
  );
  await screen.findByText(comment.content);
  return net;
}
async function reportForm(extra: Record<string, any> = {}) {
  const net = await page(extra);
  fireEvent.click(screen.getByRole("tab", { name: t.reports }));
  await field("category");
  change(field("category"), "TI");
  change(field("title"), "Report title");
  change(field("description"), "Report description");
  return net;
}
describe("src/contexts/survey/presentation/EmployeeSurveysPage.tsx | integration", () => {
  it.each(["", " ", "\t\n"])("answer %j cannot submit", async (text) => {
    const net = await page();
    change(field("response"), text);
    fireEvent.click(button("submitAnswer"));
    expect(button("submitAnswer")).toBeDisabled();
    expect(net.mutations()).toHaveLength(0);
  });
  it.each([
    ["padded", " Valid answer "],
    ["Unicode", "Ánimo 林"],
    ["1000 character boundary", "a".repeat(1000)],
  ])(
    "answer %s reaches trimmed API and refreshes comments",
    async (_name, text) => {
      const net = await page({
        "POST /api/v1/surveys/1/answers": response(null, 204),
      });
      change(field("response"), text);
      fireEvent.click(button("submitAnswer"));
      await waitFor(() =>
        expect(screen.queryByLabelText(t.response)).toBeNull(),
      );
      expect(net.mutations()[0].body).toEqual({ answer_text: text.trim() });
      await waitFor(() =>
        expect(
          net.calls.filter((c) => c.path.endsWith("/comments")),
        ).toHaveLength(2),
      );
    },
  );
  it("already answered survey cannot be answered again", async () => {
    const net = await page({
      "GET /api/v1/surveys": [{ ...survey, answered: true }],
    });
    expect(screen.queryByLabelText(t.response)).toBeNull();
    expect(net.mutations()).toHaveLength(0);
  });
  it("comments disabled survey never requests comments", async () => {
    const net = await page({
      "GET /api/v1/surveys": [{ ...survey, allow_comments: false }],
    });
    expect(net.calls.some((c) => c.path.endsWith("/comments"))).toBe(false);
  });
  it.each([401, 403, 500])(
    "answer failure %i keeps draft and routes error",
    async (status) => {
      const net = await page({
        "POST /api/v1/surveys/1/answers": response(
          { message: "failure" },
          status,
        ),
      });
      change(field("response"), "Answer");
      fireEvent.click(button("submitAnswer"));
      if (status < 500)
        await waitFor(() => expect(net.onUnauthorized).toHaveBeenCalledOnce());
      else await screen.findByRole("alert");
      expect(field("response")).toHaveValue("Answer");
    },
  );
  it("answer pending blocks repeated clicks", async () => {
    const pending = deferred<unknown>();
    const net = await page({
      "POST /api/v1/surveys/1/answers": () => pending.promise,
    });
    change(field("response"), "Answer");
    fireEvent.click(button("submitAnswer"));
    const send = document.querySelector<HTMLButtonElement>(
      ".answer-area button",
    )!;
    expect(send).toBeDisabled();
    fireEvent.click(send);
    expect(net.mutations()).toHaveLength(1);
    pending.resolve(response(null, 204));
    await waitFor(() => expect(screen.queryByLabelText(t.response)).toBeNull());
  });
  it.each(["", " \t "])("blank reply %j blocked", async (text) => {
    const net = await comments();
    fireEvent.click(button("reply"));
    change(field("replyLabel"), text);
    fireEvent.click(button("publishReply"));
    expect(button("publishReply")).toBeDisabled();
    expect(net.mutations()).toHaveLength(0);
  });
  it("reply sends parent ID and trims content", async () => {
    const net = await comments({
      "POST /api/v1/surveys/1/comments": { ...comment, id: 10 },
    });
    fireEvent.click(button("reply"));
    change(field("replyLabel"), " Thanks ");
    submit(field("replyLabel"));
    await waitFor(() =>
      expect(screen.queryByLabelText(t.replyLabel)).toBeNull(),
    );
    expect(net.mutations()[0].body).toEqual({
      content: "Thanks",
      parent_id: 5,
    });
  });
  it.each([401, 500])(
    "reply failure %i preserves unsent reply",
    async (status) => {
      const net = await comments({
        "POST /api/v1/surveys/1/comments": response(
          { message: "failure" },
          status,
        ),
      });
      fireEvent.click(button("reply"));
      change(field("replyLabel"), "Thanks");
      submit(field("replyLabel"));
      if (status === 401)
        await waitFor(() => expect(net.onUnauthorized).toHaveBeenCalledOnce());
      else await screen.findByRole("alert");
      expect(field("replyLabel")).toHaveValue("Thanks");
    },
  );
  it("like/unlike toggles only after successful persistence", async () => {
    const net = await comments({
      "POST /api/v1/surveys/1/comments/5/like": response(null, 204),
    });
    const like = document.querySelector<HTMLButtonElement>(
      ".comment-like-action",
    )!;
    fireEvent.click(like);
    await waitFor(() => expect(like).toHaveClass("is-liked"));
    await waitFor(() => expect(like).toBeEnabled());
    fireEvent.click(like);
    await waitFor(() => expect(like).not.toHaveClass("is-liked"));
    expect(net.mutations()).toHaveLength(2);
  });
  it("nonowned comment has no delete capability", async () => {
    await comments({
      "GET /api/v1/surveys/1/comments": [{ ...comment, can_delete: false }],
    });
    expect(screen.queryByRole("button", { name: t.deleteComment })).toBeNull();
  });
  it("delete requires confirmation then calls correct resource", async () => {
    const net = await comments({
      "DELETE /api/v1/surveys/1/comments/5": response(null, 204),
    });
    fireEvent.click(button("deleteComment"));
    expect(net.mutations()).toHaveLength(0);
    fireEvent.click(button("delete"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(net.mutations()[0]).toMatchObject({
      method: "DELETE",
      path: "/api/v1/surveys/1/comments/5",
    });
  });
  it("delete cancellation makes no mutation", async () => {
    const net = await comments();
    fireEvent.click(button("deleteComment"));
    fireEvent.click(button("cancel"));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(net.mutations()).toHaveLength(0);
  });
  it.each([401, 500])(
    "delete failure %i retains confirmation and comment",
    async (status) => {
      const net = await comments({
        "DELETE /api/v1/surveys/1/comments/5": response(
          { message: "failure" },
          status,
        ),
      });
      fireEvent.click(button("deleteComment"));
      fireEvent.click(button("delete"));
      if (status === 401)
        await waitFor(() => expect(net.onUnauthorized).toHaveBeenCalledOnce());
      else await screen.findByRole("alert");
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText(comment.content)).toBeInTheDocument();
    },
  );
  it("vote blocked without selecting an option", async () => {
    const net = await page();
    fireEvent.click(screen.getByRole("tab", { name: t.weeklyActivities }));
    expect(button("vote")).toBeDisabled();
    fireEvent.click(button("vote"));
    expect(net.mutations()).toHaveLength(0);
  });
  it("selected vote sends option ID and refreshes persisted totals", async () => {
    const net = await page({
      "POST /api/v1/activities/2/votes": response(null, 204),
    });
    fireEvent.click(screen.getByRole("tab", { name: t.weeklyActivities }));
    fireEvent.click(screen.getByRole("radio", { name: /Walk/ }));
    fireEvent.click(button("vote"));
    await waitFor(() =>
      expect(
        net.calls.filter((c) => c.path === "/api/v1/activities"),
      ).toHaveLength(2),
    );
    expect(net.mutations()[0].body).toEqual({ option_id: 3 });
  });
  it.each([401, 500])(
    "vote failure %i restores voting control",
    async (status) => {
      const net = await page({
        "POST /api/v1/activities/2/votes": response(
          { message: "failure" },
          status,
        ),
      });
      fireEvent.click(screen.getByRole("tab", { name: t.weeklyActivities }));
      fireEvent.click(screen.getByRole("radio", { name: /Read/ }));
      fireEvent.click(button("vote"));
      if (status === 401)
        await waitFor(() => expect(net.onUnauthorized).toHaveBeenCalledOnce());
      else await screen.findByRole("alert");
      await waitFor(() => expect(button("vote")).toBeEnabled());
    },
  );
  it.each(["category", "title", "description"] as const)(
    "missing report %s blocks submit",
    async (key) => {
      const net = await reportForm();
      change(field(key), key === "category" ? "" : " \t ");
      submit(field("title"));
      expect(button("submitReport")).toBeDisabled();
      expect(net.mutations()).toHaveLength(0);
    },
  );
  it.each([
    ["LOW", true],
    ["NORMAL", true],
    ["HIGH", false],
    ["URGENT", false],
  ])(
    "report priority %s anonymous=%s persists and resets form",
    async (priority, anonymous) => {
      const net = await reportForm({ "POST /api/v1/reports": report });
      change(field("priority"), priority);
      if (!anonymous) fireEvent.click(field("anonymous"));
      submit(field("title"));
      await waitFor(() => expect(field("title")).toHaveValue(""));
      expect(net.mutations()[0].body).toEqual({
        title: report.title,
        description: report.description,
        category: "TI",
        priority,
        anonymous,
      });
      expect(field("anonymous")).toBeChecked();
    },
  );
  it.each([401, 403, 422, 500])(
    "report failure %i preserves form and routes errors",
    async (status) => {
      const net = await reportForm({
        "POST /api/v1/reports": response({ message: "Report failed" }, status),
      });
      submit(field("title"));
      if (status < 404)
        await waitFor(() => expect(net.onUnauthorized).toHaveBeenCalledOnce());
      else
        expect(await screen.findByRole("alert")).toHaveTextContent(
          "Report failed",
        );
      expect(field("title")).toHaveValue("Report title");
    },
  );
  it("report maxima preserve full content", async () => {
    const net = await reportForm({ "POST /api/v1/reports": report });
    change(field("title"), "t".repeat(120));
    change(field("description"), "d".repeat(2000));
    submit(field("title"));
    await waitFor(() => expect(net.mutations()).toHaveLength(1));
    expect(net.mutations()[0].body.title).toHaveLength(120);
    expect(net.mutations()[0].body.description).toHaveLength(2000);
  });
  it.each(["DRAFT", "CLOSED"])(
    "survey status %s cannot collect answers",
    async (status) => {
      const net = await page({
        "GET /api/v1/surveys": [{ ...survey, status }],
      });
      expect(screen.queryByLabelText(t.response)).toBeNull();
      expect(net.calls.some((c) => c.path.endsWith("/comments"))).toBe(false);
      expect(net.mutations()).toHaveLength(0);
    },
  );
  it("closed activity cannot collect votes", async () => {
    const net = await page({
      "GET /api/v1/activities": [{ ...activity, status: "CLOSED" }],
    });
    fireEvent.click(screen.getByRole("tab", { name: t.weeklyActivities }));
    expect(screen.queryByRole("radio")).toBeNull();
    expect(net.mutations()).toHaveLength(0);
  });
  it.each([401, 500])(
    "like failure %i does not mark comment liked",
    async (status) => {
      const net = await comments({
        "POST /api/v1/surveys/1/comments/5/like": response(
          { message: "failure" },
          status,
        ),
      });
      const like = document.querySelector<HTMLButtonElement>(
        ".comment-like-action",
      )!;
      fireEvent.click(like);
      if (status === 401)
        await waitFor(() => expect(net.onUnauthorized).toHaveBeenCalledOnce());
      else await screen.findByRole("alert");
      expect(like).not.toHaveClass("is-liked");
      await waitFor(() => expect(like).toBeEnabled());
    },
  );
  it.each([401, 500])(
    "persisted vote with refresh failure %i keeps success and routes error",
    async (status) => {
      let n = 0;
      const net = await page({
        "GET /api/v1/activities": () =>
          ++n === 1 ? [activity] : response({ message: "failure" }, status),
        "POST /api/v1/activities/2/votes": response(null, 204),
      });
      fireEvent.click(screen.getByRole("tab", { name: t.weeklyActivities }));
      fireEvent.click(screen.getByRole("radio", { name: /Walk/ }));
      fireEvent.click(button("vote"));
      if (status === 401)
        await waitFor(() => expect(net.onUnauthorized).toHaveBeenCalledOnce());
      else await screen.findByRole("alert");
      expect(screen.getByRole("button", { name: t.voted })).toBeInTheDocument();
      expect(net.mutations()).toHaveLength(1);
    },
  );
  it.each([401, 403, 500])(
    "initial survey failure %i preserves fulfilled activities",
    async (status) => {
      const net = await page({
        "GET /api/v1/surveys": response({ message: "failure" }, status),
      });
      if (status < 500)
        await waitFor(() => expect(net.onUnauthorized).toHaveBeenCalledOnce());
      else await screen.findByRole("alert");
      fireEvent.click(screen.getByRole("tab", { name: t.weeklyActivities }));
      expect(screen.getByRole("radio", { name: /Walk/ })).toBeInTheDocument();
    },
  );
});
