import { describe, it, expect, vi } from "vitest";
import { HrManagementPage } from "../src/contexts/humanresources/presentation/HrManagementPage";
import {
  mount,
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
  deferred,
  t,
} from "./helpers";
async function management(
  kind: "survey" | "activity",
  extra: Record<string, any> = {},
) {
  const net = network({
    "GET /api/v1/surveys/managed": [],
    "GET /api/v1/activities/managed": [],
    ...extra,
  });
  const onUnauthorized = vi.fn();
  mount(<HrManagementPage token={token} onUnauthorized={onUnauthorized} />);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: t.refresh })).toBeEnabled(),
  );
  if (kind === "activity")
    fireEvent.click(
      screen.getByRole("tab", { name: new RegExp(t.weeklyActivities) }),
    );
  fireEvent.click(
    screen.getByRole("button", {
      name: new RegExp(kind === "survey" ? t.newSurvey : t.newActivity),
    }),
  );
  if (kind === "survey") {
    change(field("surveyTitle"), "Team feedback");
    change(field("surveyQuestion"), "How is the team?");
  } else {
    change(field("activityTitle"), "Team day");
    change(screen.getByPlaceholderText(`${t.option} 1`), " Walk ");
    change(screen.getByPlaceholderText(`${t.option} 2`), " Read ");
  }
  return { ...net, onUnauthorized };
}
describe("src/contexts/humanresources/presentation/HrManagementPage.tsx | integration", () => {
  it.each([
    ["DAILY", true],
    ["WEEKLY", true],
    ["DAILY", false],
    ["WEEKLY", false],
  ])("creates survey type %s comments=%s", async (type, comments) => {
    const net = await management("survey", { "POST /api/v1/surveys": survey });
    change(field("surveyType"), type);
    if (!comments) fireEvent.click(field("allowComments"));
    submit(field("surveyTitle"));
    await waitFor(() =>
      expect(screen.queryByLabelText(t.surveyTitle)).toBeNull(),
    );
    expect(net.mutations()[0].body).toEqual({
      title: "Team feedback",
      question: "How is the team?",
      type,
      allow_comments: comments,
    });
  });
  it.each(["surveyTitle", "surveyQuestion"] as const)(
    "native required %s prevents creation",
    async (key) => {
      const net = await management("survey");
      change(field(key), "");
      fireEvent.click(screen.getByRole("button", { name: t.create }));
      expect(field(key)).toBeInvalid();
      expect(net.mutations()).toHaveLength(0);
    },
  );
  it("survey title and question at maxima reach service", async () => {
    const net = await management("survey", { "POST /api/v1/surveys": survey });
    change(field("surveyTitle"), "a".repeat(150));
    change(field("surveyQuestion"), "q".repeat(500));
    submit(field("surveyTitle"));
    await waitFor(() => expect(net.mutations()).toHaveLength(1));
    expect(net.mutations()[0].body.title).toHaveLength(150);
    expect(net.mutations()[0].body.question).toHaveLength(500);
  });
  it.each([401, 403, 422, 500])(
    "survey failure %i routes errors and preserves draft",
    async (status) => {
      const net = await management("survey", {
        "POST /api/v1/surveys": response({ message: "Create failed" }, status),
      });
      submit(field("surveyTitle"));
      if (status < 404)
        await waitFor(() => expect(net.onUnauthorized).toHaveBeenCalledOnce());
      else
        expect(await screen.findByRole("alert")).toHaveTextContent(
          "Create failed",
        );
      expect(field("surveyTitle")).toHaveValue("Team feedback");
    },
  );
  it.each([
    ["", ""],
    [" ", "Read"],
    ["Walk", "\t"],
    [" ", "\t"],
  ])("rejects fewer than two nonblank options %j/%j", async (one, two) => {
    const net = await management("activity");
    change(screen.getByPlaceholderText(`${t.option} 1`), one);
    change(screen.getByPlaceholderText(`${t.option} 2`), two);
    submit(field("activityTitle"));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(net.mutations()).toHaveLength(0);
  });
  it("activity trims options and allows empty description", async () => {
    const net = await management("activity", {
      "POST /api/v1/activities": activity,
    });
    submit(field("activityTitle"));
    await waitFor(() =>
      expect(screen.queryByLabelText(t.activityTitle)).toBeNull(),
    );
    expect(net.mutations()[0].body).toEqual({
      title: "Team day",
      description: "",
      options: ["Walk", "Read"],
    });
  });
  it("added options are included after trimming", async () => {
    const net = await management("activity", {
      "POST /api/v1/activities": activity,
    });
    fireEvent.click(
      screen.getByRole("button", { name: new RegExp(t.addOption) }),
    );
    change(screen.getByPlaceholderText(`${t.option} 3`), " Play ");
    submit(field("activityTitle"));
    await waitFor(() => expect(net.mutations()).toHaveLength(1));
    expect(net.mutations()[0].body.options).toEqual(["Walk", "Read", "Play"]);
  });
  it("blank added option filtered when two valid options remain", async () => {
    const net = await management("activity", {
      "POST /api/v1/activities": activity,
    });
    fireEvent.click(
      screen.getByRole("button", { name: new RegExp(t.addOption) }),
    );
    change(screen.getByPlaceholderText(`${t.option} 3`), " ");
    submit(field("activityTitle"));
    await waitFor(() => expect(net.mutations()).toHaveLength(1));
    expect(net.mutations()[0].body.options).toEqual(["Walk", "Read"]);
  });
  it.each([401, 403, 422, 500])(
    "activity failure %i routes auth or service message",
    async (status) => {
      const net = await management("activity", {
        "POST /api/v1/activities": response(
          { message: "Activity failed" },
          status,
        ),
      });
      submit(field("activityTitle"));
      if (status < 404)
        await waitFor(() => expect(net.onUnauthorized).toHaveBeenCalledOnce());
      else
        expect(await screen.findByRole("alert")).toHaveTextContent(
          "Activity failed",
        );
      expect(field("activityTitle")).toHaveValue("Team day");
    },
  );
  it("activity pending button prevents second user create", async () => {
    const pending = deferred<unknown>();
    const net = await management("activity", {
      "POST /api/v1/activities": () => pending.promise,
    });
    submit(field("activityTitle"));
    const create = document.querySelector<HTMLButtonElement>(
      'form button[type="submit"]',
    )!;
    expect(create).toBeDisabled();
    fireEvent.click(create);
    expect(net.mutations()).toHaveLength(1);
    pending.resolve(activity);
    await waitFor(() =>
      expect(screen.queryByLabelText(t.activityTitle)).toBeNull(),
    );
  });
  async function loaded(extra: Record<string, any> = {}) {
    const net = network({
      "GET /api/v1/surveys/managed": [{ ...survey, status: "DRAFT" }],
      "GET /api/v1/activities/managed": [activity],
      ...extra,
    });
    const onUnauthorized = vi.fn();
    mount(<HrManagementPage token={token} onUnauthorized={onUnauthorized} />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: t.refresh })).toBeEnabled(),
    );
    return { ...net, onUnauthorized };
  }
  it("draft publication replaces lifecycle state", async () => {
    const net = await loaded({ "POST /api/v1/surveys/1/publish": survey });
    fireEvent.click(screen.getByRole("button", { name: t.publish }));
    await screen.findByRole("button", { name: t.close });
    expect(net.mutations()[0].path).toBe("/api/v1/surveys/1/publish");
  });
  it("published survey closes and loses mutation control", async () => {
    const net = await loaded({
      "GET /api/v1/surveys/managed": [survey],
      "POST /api/v1/surveys/1/close": { ...survey, status: "CLOSED" },
    });
    fireEvent.click(screen.getByRole("button", { name: t.close }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: t.close })).toBeNull(),
    );
    expect(net.mutations()[0].path).toBe("/api/v1/surveys/1/close");
  });
  it("closed survey cannot be republished from controls", async () => {
    const net = await loaded({
      "GET /api/v1/surveys/managed": [{ ...survey, status: "CLOSED" }],
    });
    expect(screen.queryByRole("button", { name: t.publish })).toBeNull();
    expect(screen.queryByRole("button", { name: t.close })).toBeNull();
    expect(net.mutations()).toHaveLength(0);
  });
  it.each([401, 500])(
    "publication failure %i retains draft",
    async (status) => {
      const net = await loaded({
        "POST /api/v1/surveys/1/publish": response(
          { message: "failure" },
          status,
        ),
      });
      fireEvent.click(screen.getByRole("button", { name: t.publish }));
      if (status === 401)
        await waitFor(() => expect(net.onUnauthorized).toHaveBeenCalledOnce());
      else await screen.findByRole("alert");
      expect(
        screen.getByRole("button", { name: t.publish }),
      ).toBeInTheDocument();
    },
  );
  it("activity closure refreshes backend lifecycle state", async () => {
    let n = 0;
    const net = await loaded({
      "GET /api/v1/activities/managed": () => [
        { ...activity, status: ++n === 1 ? "OPEN" : "CLOSED" },
      ],
      "POST /api/v1/activities/2/close": response(null, 204),
    });
    fireEvent.click(
      screen.getByRole("tab", { name: new RegExp(t.weeklyActivities) }),
    );
    fireEvent.click(screen.getByRole("button", { name: t.close }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: t.close })).toBeNull(),
    );
    expect(net.mutations()[0].path).toBe("/api/v1/activities/2/close");
  });
  it.each([401, 500])(
    "activity closure failure %i retains open activity",
    async (status) => {
      const net = await loaded({
        "POST /api/v1/activities/2/close": response(
          { message: "failure" },
          status,
        ),
      });
      fireEvent.click(
        screen.getByRole("tab", { name: new RegExp(t.weeklyActivities) }),
      );
      fireEvent.click(screen.getByRole("button", { name: t.close }));
      if (status === 401)
        await waitFor(() => expect(net.onUnauthorized).toHaveBeenCalledOnce());
      else await screen.findByRole("alert");
      expect(screen.getByRole("button", { name: t.close })).toBeInTheDocument();
    },
  );
  it("managed comments are cached across panel toggles", async () => {
    const net = await loaded({ "GET /api/v1/surveys/1/comments": [comment] });
    fireEvent.click(screen.getByRole("button", { name: t.showComments }));
    await screen.findByText(comment.content);
    fireEvent.click(screen.getByRole("button", { name: t.hideComments }));
    fireEvent.click(screen.getByRole("button", { name: t.showComments }));
    expect(net.calls.filter((c) => c.path.endsWith("/comments"))).toHaveLength(
      1,
    );
  });
  it.each([401, 500])(
    "managed comments failure %i routes error",
    async (status) => {
      const net = await loaded({
        "GET /api/v1/surveys/1/comments": response(
          { message: "failure" },
          status,
        ),
      });
      fireEvent.click(screen.getByRole("button", { name: t.showComments }));
      if (status === 401)
        await waitFor(() => expect(net.onUnauthorized).toHaveBeenCalledOnce());
      else await screen.findByRole("alert");
      expect(
        net.calls.filter((c) => c.path.endsWith("/comments")),
      ).toHaveLength(1);
    },
  );
  it.each([
    [-5, 0],
    [120, 100],
    [49.6, 50],
  ])("activity percentage %s normalizes to %s", async (value, expected) => {
    await loaded({
      "GET /api/v1/activities/managed": [
        {
          ...activity,
          options: [{ ...activity.options[0], percentage: value }],
        },
      ],
    });
    fireEvent.click(
      screen.getByRole("tab", { name: new RegExp(t.weeklyActivities) }),
    );
    expect(screen.getByRole("progressbar", { name: "Walk" })).toHaveAttribute(
      "aria-valuenow",
      String(expected),
    );
  });
});
