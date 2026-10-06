import { describe, it, expect } from "vitest";
import { App } from "../src/app/App";
import { saveSession } from "../src/infrastructure/auth/sessionStorage";
import {
  mount,
  field,
  button,
  change,
  submit,
  screen,
  waitFor,
  fireEvent,
  network,
  response,
  token,
  apiProfile,
  session,
  t,
} from "./helpers";
const summary = {
  date: "2026-01-01",
  total_responses: 0,
  distribution: {},
  active_employees: 0,
  response_rate: 0,
};
function app(
  role: "EMPLOYEE" | "HR_MEMBER" | "SYSTEM_ADMIN",
  page: string,
  extra: Record<string, any> = {},
) {
  saveSession({ ...session, role });
  window.location.hash = `#/${page}`;
  const net = network({
    "GET /api/v1/profile": { ...apiProfile, role },
    "GET /api/v1/mood/today": null,
    "GET /api/v1/mood/summary": summary,
    "GET /api/v1/surveys": [],
    "GET /api/v1/activities": [],
    "GET /api/v1/ai/conversations": [],
    "GET /api/v1/surveys/managed": [],
    "GET /api/v1/activities/managed": [],
    "GET /api/v1/reports": [],
    ...extra,
  });
  const view = mount(<App />);
  return { ...net, ...view };
}
describe("src/app/App.tsx | integration", () => {
  it.each([
    ["EMPLOYEE", "home", "home"],
    ["EMPLOYEE", "surveys", "surveys"],
    ["EMPLOYEE", "ai", "ai"],
    ["EMPLOYEE", "settings", "settings"],
    ["EMPLOYEE", "profile", "profile"],
    ["HR_MEMBER", "home", "home"],
    ["HR_MEMBER", "management", "management"],
    ["HR_MEMBER", "reports", "reports"],
    ["HR_MEMBER", "settings", "settings"],
    ["HR_MEMBER", "profile", "profile"],
  ] as const)("%s permits route %s", async (role, page, title) => {
    const net = app(role, page);
    await screen.findByRole("heading", { level: 1, name: t[title] });
    await waitFor(() =>
      expect(net.calls.some((c) => c.path === "/api/v1/profile")).toBe(true),
    );
    expect(screen.queryByLabelText(t.usernameOrEmail)).toBeNull();
  });
  it.each([
    ["EMPLOYEE", "management"],
    ["EMPLOYEE", "reports"],
    ["EMPLOYEE", "../management"],
    ["HR_MEMBER", "ai"],
    ["HR_MEMBER", "surveys"],
    ["HR_MEMBER", "unknown"],
  ] as const)("%s rejects forged route %s", async (role, page) => {
    const net = app(role, page);
    await screen.findByRole("heading", { level: 1, name: t.home });
    await waitFor(() =>
      expect(net.calls.some((c) => c.path.includes("/mood/"))).toBe(true),
    );
    expect(
      net.calls.some(
        (c) =>
          c.path.includes("/managed") ||
          c.path.includes("/conversations") ||
          c.path === "/api/v1/reports",
      ),
    ).toBe(false);
  });
  it.each([401, 403])(
    "profile failure %i logs out and removes session",
    async (status) => {
      app("EMPLOYEE", "profile", {
        "GET /api/v1/profile": response({ message: "Expired" }, status),
      });
      await screen.findByLabelText(t.usernameOrEmail);
      expect(sessionStorage.getItem("safespace.web.session")).toBeNull();
    },
  );
  it("corrupt storage renders login without API requests", () => {
    sessionStorage.setItem("safespace.web.session", '{"role":"ADMIN"}');
    const net = network({});
    mount(<App />);
    expect(field("usernameOrEmail")).toBeInTheDocument();
    expect(net.fetch).not.toHaveBeenCalled();
  });
  it("system admin restored session remains restricted", async () => {
    const net = app("SYSTEM_ADMIN", "management");
    await screen.findByRole("heading", { name: t.systemAdminPortal });
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(net.calls.some((c) => c.path.endsWith("managed"))).toBe(false);
  });
  it("sign out clears session and returns to login", async () => {
    app("EMPLOYEE", "profile");
    await screen.findByRole("heading", { level: 1, name: t.profile });
    fireEvent.click(button("signOut"));
    expect(field("usernameOrEmail")).toBeInTheDocument();
    expect(sessionStorage.getItem("safespace.web.session")).toBeNull();
  });
  it("successful login persists session and resets forged hash", async () => {
    const net = network({
      "POST /api/v1/auth/login": { ...apiProfile, token },
      "GET /api/v1/profile": apiProfile,
      "GET /api/v1/mood/today": null,
    });
    window.location.hash = "#/management";
    mount(<App />);
    change(field("usernameOrEmail"), "ana");
    change(field("password"), "Password1!");
    submit(field("password"));
    await screen.findByRole("heading", { level: 1, name: t.home });
    expect(window.location.hash).toBe("#/home");
    expect(
      JSON.parse(sessionStorage.getItem("safespace.web.session")!).role,
    ).toBe("EMPLOYEE");
    expect(net.mutations()).toHaveLength(1);
  });
  it("valid saved local theme applied when profile lookup is unavailable", async () => {
    localStorage.setItem("safespace.user.1.theme", "dark");
    app("EMPLOYEE", "profile", {
      "GET /api/v1/profile": response({ message: "offline" }, 503),
    });
    await waitFor(() =>
      expect(document.documentElement.dataset.theme).toBe("dark"),
    );
  });
  it("invalid saved preferences cannot alter theme or language", async () => {
    localStorage.setItem("safespace.user.1.theme", "script");
    localStorage.setItem("safespace.user.1.language", "xx");
    app("EMPLOYEE", "profile", {
      "GET /api/v1/profile": response({ message: "offline" }, 503),
    });
    await waitFor(() =>
      expect(document.documentElement.dataset.theme).toBe("light"),
    );
    expect(document.documentElement.lang).toBe("es");
  });
  it("another user's saved theme cannot affect this session", async () => {
    localStorage.setItem("safespace.user.2.theme", "dark");
    app("EMPLOYEE", "profile", {
      "GET /api/v1/profile": response({ message: "offline" }, 503),
    });
    await waitFor(() =>
      expect(document.documentElement.dataset.theme).toBe("light"),
    );
  });
});
