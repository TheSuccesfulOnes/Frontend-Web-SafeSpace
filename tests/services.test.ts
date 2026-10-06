import { describe, it, expect } from "vitest";
import * as authService from "../src/infrastructure/auth/authService";
import * as profileService from "../src/infrastructure/profile/profileService";
import * as aiService from "../src/infrastructure/ai/aiService";
import * as content from "../src/infrastructure/content/contentService";
import { ApiError } from "../src/infrastructure/api/apiClient";
import {
  network,
  response,
  auth,
  token,
  apiProfile,
  survey,
  comment,
  report,
  activity,
} from "./helpers";

describe("src/infrastructure/auth/authService.ts | integration", () => {
  it.each([
    [" ana ", " Password1! "],
    ["ana@example.test", "old"],
    [" Ána ", "Árbol123!"],
    ["\tana\n", "pass\t"],
  ])(
    "login preserves password and trims identifier %j",
    async (identifier, password) => {
      const net = network({ "POST /api/v1/auth/login": auth });
      const result = await authService.login(identifier, password);
      expect(net.mutations()[0].body).toEqual({
        identifier: identifier.trim(),
        password,
      });
      expect(result).toMatchObject({
        displayName: auth.display_name,
        userId: 1,
      });
    },
  );
  it.each([
    [" Ana ", " ana ", " ana@example.test "],
    ["Ána 林", "ana", "a@example.test"],
    ["a".repeat(100), "u".repeat(50), "a@example.test"],
    ["\tAna\n", "\tana\n", "a@example.test"],
  ])(
    "registration normalizes identity %j",
    async (displayName, username, email) => {
      const net = network({ "POST /api/v1/auth/register": auth });
      await authService.register({
        displayName,
        username,
        email,
        password: " Password1! ",
        confirmPassword: " Password1! ",
      });
      expect(net.mutations()[0].body).toEqual({
        display_name: displayName.trim(),
        username: username.trim(),
        email: email.trim(),
        password: " Password1! ",
        confirm_password: " Password1! ",
      });
      expect(net.mutations()[0].headers.Authorization).toBeUndefined();
    },
  );
  it.each([" ana ", "ana@example.test", " Ána ", "\tana\n"])(
    "recovery trims identifier %j without bearer",
    async (identifier) => {
      const net = network({
        "POST /api/v1/auth/password-recovery/request": { message: "queued" },
      });
      expect(await authService.requestPasswordRecovery(identifier)).toBe(
        "queued",
      );
      expect(net.mutations()[0].body).toEqual({
        identifier: identifier.trim(),
      });
      expect(net.mutations()[0].headers.Authorization).toBeUndefined();
    },
  );
  it.each([
    ["login", 401],
    ["login", 429],
    ["register", 409],
    ["register", 422],
    ["recovery", 400],
    ["recovery", 503],
  ])("%s failure %i remains typed API error", async (kind, status) => {
    const path = kind === "recovery" ? "password-recovery/request" : kind;
    network({
      [`POST /api/v1/auth/${path}`]: response(
        { message: "Denied", code: "TEST" },
        status,
      ),
    });
    const task =
      kind === "login"
        ? authService.login("ana", "pass")
        : kind === "recovery"
          ? authService.requestPasswordRecovery("ana")
          : authService.register({
              displayName: "Ana",
              username: "ana",
              email: "a@example.test",
              password: "Password1!",
              confirmPassword: "Password1!",
            });
    await expect(task).rejects.toMatchObject({ status, code: "TEST" });
  });
  it.each(["HR_MEMBER", "SYSTEM_ADMIN"])(
    "maps supported server role %s without inventing permissions",
    async (role) => {
      network({ "POST /api/v1/auth/login": { ...auth, role } });
      expect((await authService.login("ana", "pass")).role).toBe(role);
    },
  );
});

describe("src/infrastructure/profile/profileService.ts | integration", () => {
  it.each([
    ["EN", "en"],
    ["en", "en"],
    ["En", "en"],
    ["ES", "es"],
    ["fr", "es"],
    ["", "es"],
  ])("language %j normalized to %s", async (language, expected) => {
    network({ "GET /api/v1/profile": { ...apiProfile, language } });
    expect((await profileService.getProfile(token)).language).toBe(expected);
  });
  it.each([
    ["DARK", "dark"],
    ["Dark", "dark"],
    ["dark", "dark"],
    ["LIGHT", "light"],
    ["system", "light"],
  ])("theme %s normalized to %s", async (theme, expected) => {
    network({ "GET /api/v1/profile": { ...apiProfile, theme } });
    expect((await profileService.getProfile(token)).theme).toBe(expected);
  });
  it.each([
    [" Ana ", " ana ", " new@example.test ", "new@example.test"],
    ["Ana", "ana", "", null],
    ["Ana", "ana", " \t ", null],
    ["Ána 林", "user_1", "a@example.test", "a@example.test"],
  ])(
    "account %j sanitizes identity and optional email",
    async (displayName, username, email, expectedEmail) => {
      const net = network({
        "PUT /api/v1/profile/account": {
          profile: apiProfile,
          token: "rotated",
        },
      });
      const result = await profileService.updateAccount(token, {
        displayName,
        username,
        email,
      });
      expect(net.mutations()[0].body).toEqual({
        display_name: displayName.trim(),
        username: username.trim(),
        email: expectedEmail,
      });
      expect(result.token).toBe("rotated");
      expect(result.profile.userId).toBe(1);
    },
  );
  it.each([
    ["es", "light"],
    ["es", "dark"],
    ["en", "light"],
    ["en", "dark"],
  ] as const)(
    "preferences %s/%s use authenticated PUT",
    async (language, theme) => {
      const net = network({
        "PUT /api/v1/profile/preferences": { ...apiProfile, language, theme },
      });
      const result = await profileService.updatePreferences(
        token,
        language,
        theme,
      );
      expect(net.mutations()[0]).toMatchObject({
        method: "PUT",
        body: { language, theme },
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(result).toMatchObject({ language, theme });
    },
  );
  it.each([
    ["GET /api/v1/profile", 401],
    ["PUT /api/v1/profile/account", 409],
    ["PUT /api/v1/profile/preferences", 403],
  ])("error contract %s status %i", async (route, status) => {
    network({ [route]: response({ message: "Denied" }, status) });
    const task = route.startsWith("GET")
      ? profileService.getProfile(token)
      : route.endsWith("account")
        ? profileService.updateAccount(token, {
            username: "a",
            displayName: "A",
            email: "",
          })
        : profileService.updatePreferences(token, "es", "light");
    await expect(task).rejects.toMatchObject({ status });
  });
});

describe("src/infrastructure/ai/aiService.ts | integration", () => {
  const prefix = "/api/v1/ai/conversations";
  it.each([
    ["trimmed Spanish message", " hello ", "es"],
    ["Unicode English message", "Ánimo 林 🔒", "en"],
    ["4000 character boundary", "a".repeat(4000), "es"],
    ["multiline message", "\tline one\nline two\n", "en"],
  ] as const)("send %s", async (_name, content, language) => {
    const net = network({
      [`POST ${prefix}/7/messages`]: [
        {
          id: 2,
          sender: "ASSISTANT",
          content: "Reply",
          created_at: "2026-01-01",
        },
      ],
    });
    const result = await aiService.sendMessage(token, 7, content, language);
    expect(net.mutations()[0].body).toEqual({
      content: content.trim(),
      language,
    });
    expect(result[0].createdAt).toBe("2026-01-01");
  });
  it.each([" New name ", "Ánimo 林", "a".repeat(160), "\tNew\n"])(
    "rename content %j",
    async (title) => {
      const net = network({
        [`PATCH ${prefix}/7`]: { id: 7, title: title.trim() },
      });
      expect(await aiService.renameConversation(token, 7, title)).toEqual({
        id: 7,
        title: title.trim(),
      });
      expect(net.mutations()[0].body).toEqual({ title: title.trim() });
    },
  );
  it("list returns conversation identifiers", async () => {
    const net = network({ [`GET ${prefix}`]: [{ id: 7, title: "A" }] });
    expect(await aiService.getConversations(token)).toEqual([
      { id: 7, title: "A" },
    ]);
    expect(net.calls[0].headers.Authorization).toBe(`Bearer ${token}`);
  });
  it("create sends no artificial content", async () => {
    const net = network({ [`POST ${prefix}`]: { id: 7, title: "A" } });
    await aiService.createConversation(token);
    expect(net.mutations()[0].body).toBeUndefined();
  });
  it("delete accepts no-content response", async () => {
    const net = network({ [`DELETE ${prefix}/7`]: response(null, 204) });
    expect(await aiService.deleteConversation(token, 7)).toBeUndefined();
    expect(net.mutations()[0].path).toBe(`${prefix}/7`);
  });
  it("empty message history", async () => {
    network({ [`GET ${prefix}/7/messages`]: [] });
    expect(await aiService.getMessages(token, 7)).toEqual([]);
  });
  it("maps message timestamps and preserves senders", async () => {
    network({
      [`GET ${prefix}/7/messages`]: [
        { id: 1, sender: "USER", content: "Hi", created_at: "2026-01-01" },
        {
          id: 2,
          sender: "ASSISTANT",
          content: "Hello",
          created_at: "2026-01-02",
        },
      ],
    });
    expect(await aiService.getMessages(token, 7)).toMatchObject([
      { sender: "USER", createdAt: "2026-01-01" },
      { sender: "ASSISTANT", createdAt: "2026-01-02" },
    ]);
  });
  const operations = [
    ["list", `GET ${prefix}`, () => aiService.getConversations(token)],
    ["create", `POST ${prefix}`, () => aiService.createConversation(token)],
    [
      "rename",
      `PATCH ${prefix}/7`,
      () => aiService.renameConversation(token, 7, "A"),
    ],
    [
      "delete",
      `DELETE ${prefix}/7`,
      () => aiService.deleteConversation(token, 7),
    ],
    [
      "history",
      `GET ${prefix}/7/messages`,
      () => aiService.getMessages(token, 7),
    ],
    [
      "send",
      `POST ${prefix}/7/messages`,
      () => aiService.sendMessage(token, 7, "Hi", "es"),
    ],
  ] as const;
  it.each(operations)(
    "%s authorization failure propagates",
    async (_name, route, invoke) => {
      network({ [route]: response({ message: "Expired" }, 401) });
      await expect(invoke()).rejects.toMatchObject({ status: 401 });
    },
  );
  it("rate limited send propagates code", async () => {
    network({
      [`POST ${prefix}/7/messages`]: response(
        { message: "Rate limit", code: "RATE_LIMIT" },
        429,
      ),
    });
    await expect(
      aiService.sendMessage(token, 7, "Hi", "es"),
    ).rejects.toMatchObject({ status: 429, code: "RATE_LIMIT" });
  });
});

describe("src/infrastructure/content/contentService.ts | integration", () => {
  it.each([
    ["padded answer", " Answer "],
    ["Unicode answer", "Ánimo 林"],
    ["1000 character boundary", "a".repeat(1000)],
  ])("answer %s trimmed", async (_name, answer) => {
    const net = network({
      "POST /api/v1/surveys/1/answers": response(null, 204),
    });
    await content.answerSurvey(token, 1, answer);
    expect(net.mutations()[0].body).toEqual({ answer_text: answer.trim() });
  });
  it.each([
    [undefined, null],
    [5, 5],
  ])("comment parent %s serialized", async (parent, expected) => {
    const net = network({ "POST /api/v1/surveys/1/comments": comment });
    const result = await content.addComment(token, 1, " Reply ", parent);
    expect(net.mutations()[0].body).toEqual({
      content: "Reply",
      parent_id: expected,
    });
    expect(result).toMatchObject({
      canDelete: true,
      createdAt: comment.created_at,
      replies: [],
    });
  });
  it("nested comments recursively normalize ownership and timestamp", async () => {
    network({
      "GET /api/v1/surveys/1/comments": [
        {
          ...comment,
          replies: [
            { ...comment, id: 10, can_delete: false, replies: undefined },
          ],
        },
      ],
    });
    expect((await content.getComments(token, 1))[0].replies[0]).toMatchObject({
      id: 10,
      canDelete: false,
      replies: [],
    });
  });
  it.each([true, false])(
    "survey comments=%s mapped in create contract",
    async (allowComments) => {
      const net = network({
        "POST /api/v1/surveys": { ...survey, allow_comments: allowComments },
      });
      const result = await content.createSurvey(token, {
        title: "A",
        question: "Q",
        type: "WEEKLY",
        allowComments,
      });
      expect(net.mutations()[0].body).toEqual({
        title: "A",
        question: "Q",
        type: "WEEKLY",
        allow_comments: allowComments,
      });
      expect(result.allowComments).toBe(allowComments);
    },
  );
  it("survey list maps comment policy", async () => {
    network({ "GET /api/v1/surveys": [survey] });
    expect((await content.getSurveys(token))[0].allowComments).toBe(true);
  });
  it("managed survey list maps policy", async () => {
    network({
      "GET /api/v1/surveys/managed": [{ ...survey, allow_comments: false }],
    });
    expect((await content.getManagedSurveys(token))[0].allowComments).toBe(
      false,
    );
  });
  it.each(["publish", "close"] as const)(
    "survey lifecycle %s uses POST",
    async (action) => {
      const net = network({
        [`POST /api/v1/surveys/1/${action}`]: {
          ...survey,
          status: action === "publish" ? "PUBLISHED" : "CLOSED",
        },
      });
      expect((await content.changeSurveyStatus(token, 1, action)).status).toBe(
        action === "publish" ? "PUBLISHED" : "CLOSED",
      );
      expect(net.mutations()[0].body).toBeUndefined();
    },
  );
  it("vote uses activity and option IDs", async () => {
    const net = network({
      "POST /api/v1/activities/2/votes": response(null, 204),
    });
    await content.voteActivity(token, 2, 4);
    expect(net.mutations()[0].body).toEqual({ option_id: 4 });
  });
  it("delete comment uses DELETE without body", async () => {
    const net = network({
      "DELETE /api/v1/surveys/1/comments/5": response(null, 204),
    });
    await content.deleteComment(token, 1, 5);
    expect(net.mutations()[0].body).toBeUndefined();
  });
  it("like uses POST without body", async () => {
    const net = network({
      "POST /api/v1/surveys/1/comments/5/like": response(null, 204),
    });
    await content.likeComment(token, 1, 5);
    expect(net.mutations()[0].method).toBe("POST");
  });
  it.each([true, false])("report anonymity=%s preserved", async (anonymous) => {
    const net = network({ "POST /api/v1/reports": { ...report, anonymous } });
    const result = await content.createReport(token, {
      category: "TI",
      title: "A",
      description: "D",
      priority: "URGENT",
      anonymous,
    });
    expect(net.mutations()[0].body.anonymous).toBe(anonymous);
    expect(result).toMatchObject({
      anonymous,
      createdAt: report.created_at,
      reporterDisplayName: null,
    });
  });
  it("report status mutation sends exact lifecycle enum", async () => {
    const net = network({
      "PATCH /api/v1/reports/6/status": { ...report, status: "IN_REVIEW" },
    });
    expect(
      (await content.updateReportStatus(token, 6, "IN_REVIEW")).status,
    ).toBe("IN_REVIEW");
    expect(net.mutations()[0].body).toEqual({ status: "IN_REVIEW" });
  });
  it("mood summary normalizes backend metrics", async () => {
    network({
      "GET /api/v1/mood/summary": {
        date: "2026-01-01",
        total_responses: 0,
        distribution: {},
        active_employees: 2,
        response_rate: 0,
      },
    });
    expect(await content.getMoodSummary(token)).toEqual({
      date: "2026-01-01",
      totalResponses: 0,
      distribution: {},
      activeEmployees: 2,
      responseRate: 0,
    });
  });
  it("activity creation preserves options order", async () => {
    const net = network({ "POST /api/v1/activities": activity });
    await content.createActivity(token, {
      title: "A",
      description: "D",
      options: ["Walk", "Read"],
    });
    expect(net.mutations()[0].body.options).toEqual(["Walk", "Read"]);
  });
  it.each([
    [
      "POST /api/v1/surveys/1/answers",
      () => content.answerSurvey(token, 1, "Answer"),
    ],
    [
      "POST /api/v1/activities/2/votes",
      () => content.voteActivity(token, 2, 4),
    ],
    [
      "DELETE /api/v1/surveys/1/comments/5",
      () => content.deleteComment(token, 1, 5),
    ],
    [
      "PATCH /api/v1/reports/6/status",
      () => content.updateReportStatus(token, 6, "CLOSED"),
    ],
  ] as const)(
    "denied mutation %s propagates without masking",
    async (route, invoke) => {
      network({ [route]: response({ message: "Denied" }, 403) });
      await expect(invoke()).rejects.toBeInstanceOf(ApiError);
    },
  );
});
