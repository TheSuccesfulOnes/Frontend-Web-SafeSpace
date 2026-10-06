import { describe, it, expect, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { ProfilePage } from "../src/contexts/profile/presentation/ProfilePage";
import { SettingsPage } from "../src/contexts/profile/presentation/SettingsPage";
import { ApiError } from "../src/infrastructure/api/apiClient";
import {
  mount,
  profile,
  apiProfile,
  field,
  change,
  screen,
  waitFor,
  fireEvent,
  network,
  response,
  token,
  deferred,
  t,
} from "./helpers";

describe("src/contexts/profile/presentation/ProfilePage.tsx | integration", () => {
  function upload(type: string, size: number, name = "avatar") {
    const view = mount(<ProfilePage profile={profile} />);
    const input = view.container.querySelector('input[type="file"]')!;
    const file = new File([new Uint8Array(size)], name, { type });
    fireEvent.change(input, { target: { files: [file] } });
    return view;
  }
  it.each([
    ["text/plain", 20],
    ["application/pdf", 20],
    ["", 20],
    ["image/svg+xml", 20],
    ["image/gif", 20],
    ["image/bmp", 20],
    ["image/avif", 20],
    ["application/octet-stream", 20],
    ["image/png", 1048577],
    ["image/jpeg", 1048577],
    ["image/webp", 1048577],
  ])("rejects MIME %s with %i bytes", (type, size) => {
    const reader = vi.spyOn(FileReader.prototype, "readAsDataURL");
    upload(type, size);
    expect(screen.getByRole("alert")).toHaveTextContent(t.errorGeneric);
    expect(reader).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
  });
  it.each([
    ["image/png", 1],
    ["image/jpeg", 1],
    ["image/webp", 1],
    ["image/png", 1048576],
    ["image/jpeg", 1048576],
    ["image/webp", 1048576],
  ])("persists supported %s at %i bytes", async (type, size) => {
    const view = upload(type, size);
    await waitFor(() =>
      expect(view.container.querySelector("img")).not.toBeNull(),
    );
    const stored = localStorage.getItem("safespace.avatar.1");
    expect(stored).toMatch(new RegExp(`^data:${type};base64,`));
    expect(view.container.querySelector("img")).toHaveAttribute("src", stored);
    expect(localStorage.getItem("safespace.avatar.2")).toBeNull();
  });
  it("cancel selection rejects without reading", () => {
    const view = mount(<ProfilePage profile={profile} />);
    fireEvent.change(view.container.querySelector("input")!, {
      target: { files: [] },
    });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(localStorage.length).toBe(0);
  });
  it("invalid replacement preserves existing avatar", () => {
    localStorage.setItem("safespace.avatar.1", "data:image/png;base64,AA==");
    const view = upload("text/plain", 2);
    expect(view.container.querySelector("img")).toHaveAttribute(
      "src",
      "data:image/png;base64,AA==",
    );
    expect(localStorage.getItem("safespace.avatar.1")).toBe(
      "data:image/png;base64,AA==",
    );
  });
  it("valid replacement clears previous upload error", async () => {
    const view = upload("text/plain", 2);
    fireEvent.change(view.container.querySelector("input")!, {
      target: { files: [new File(["x"], "safe.png", { type: "image/png" })] },
    });
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(localStorage.getItem("safespace.avatar.1")).toContain(
      "data:image/png",
    );
  });
  it("file extension cannot bypass MIME validation", () => {
    upload("text/html", 10, "photo.png");
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(localStorage.length).toBe(0);
  });
});

function settings(overrides: Record<string, unknown> = {}) {
  const onProfileUpdated = vi.fn(),
    onUnauthorized = vi.fn(),
    onPreferencesUpdated = vi.fn().mockResolvedValue(undefined);
  const props = {
    token,
    profile,
    onProfileUpdated,
    onUnauthorized,
    onPreferencesUpdated,
    ...overrides,
  };
  const view = mount(<SettingsPage {...props} />);
  return { ...props, ...view };
}
function accountForm() {
  return field("changeDisplayName").closest("form")!;
}
function preferencesButton() {
  return document.querySelector<HTMLButtonElement>(
    ".settings-section .secondary-button",
  )!;
}
describe("src/contexts/profile/presentation/SettingsPage.tsx | integration", () => {
  it.each([
    [
      "trim all fields",
      " Ana ",
      " ana2 ",
      " ana2@example.test ",
      "ana2@example.test",
    ],
    ["empty email clears", "Ana", "ana2", "", null],
    ["spaces email clears", "Ana", "ana2", "   ", null],
    ["Unicode name", "Ána 林", "ana2", "new@example.test", "new@example.test"],
    [
      "name maximum",
      "a".repeat(100),
      "ana2",
      "new@example.test",
      "new@example.test",
    ],
    [
      "username maximum",
      "Ana",
      "a".repeat(50),
      "new@example.test",
      "new@example.test",
    ],
  ])(
    "%s serializes account and rotates callback token",
    async (_name, name, username, email, expectedEmail) => {
      const net = network({
        "PUT /api/v1/profile/account": {
          profile: apiProfile,
          token: "rotated-test",
        },
      });
      const props = settings();
      change(field("changeDisplayName"), name);
      change(field("changeUsername"), username);
      change(field("changeEmail"), email);
      fireEvent.submit(accountForm());
      await waitFor(() =>
        expect(props.onProfileUpdated).toHaveBeenCalledWith(
          expect.objectContaining({ userId: 1 }),
          "rotated-test",
        ),
      );
      expect(net.mutations()[0].body).toEqual({
        display_name: name.trim(),
        username: username.trim(),
        email: expectedEmail,
      });
      expect(net.mutations()[0].headers.Authorization).toBe(`Bearer ${token}`);
    },
  );
  it.each(["changeDisplayName", "changeUsername", "changeEmail"] as const)(
    "native invalid %s blocks user submit",
    (key) => {
      const net = network({
        "PUT /api/v1/profile/account": { profile: apiProfile, token },
      });
      settings();
      change(field(key), key === "changeEmail" ? "bad" : "");
      screen
        .getAllByRole("button", { name: new RegExp(t.saveChanges) })[0]
        .click();
      expect(field(key)).toBeInvalid();
      expect(net.fetch).not.toHaveBeenCalled();
    },
  );
  it.each([401, 403, 409, 500])(
    "account API status %i preserves fields and routes auth failures",
    async (status) => {
      network({
        "PUT /api/v1/profile/account": response(
          { message: "Account failed" },
          status,
        ),
      });
      const props = settings();
      change(field("changeUsername"), "changed");
      fireEvent.submit(accountForm());
      if (status === 401 || status === 403)
        await waitFor(() =>
          expect(props.onUnauthorized).toHaveBeenCalledOnce(),
        );
      else
        expect(await screen.findByRole("alert")).toHaveTextContent(
          "Account failed",
        );
      expect(props.onProfileUpdated).not.toHaveBeenCalled();
      expect(field("changeUsername")).toHaveValue("changed");
    },
  );
  it.each([
    ["es", "light"],
    ["en", "light"],
    ["es", "dark"],
    ["en", "dark"],
  ])("saves preferences %s/%s", async (language, theme) => {
    const props = settings();
    change(field("language"), language);
    if (theme === "dark") fireEvent.click(field("theme"));
    fireEvent.click(preferencesButton());
    await waitFor(() =>
      expect(props.onPreferencesUpdated).toHaveBeenCalledWith(language, theme),
    );
  });
  it.each([401, 403, 500])(
    "preference failure %i unlocks controls",
    async (status) => {
      const onPreferencesUpdated = vi
        .fn()
        .mockRejectedValue(new ApiError("Preferences failed", status));
      const props = settings({ onPreferencesUpdated });
      preferencesButton().click();
      if (status < 500)
        await waitFor(() =>
          expect(props.onUnauthorized).toHaveBeenCalledOnce(),
        );
      else
        expect(await screen.findByRole("alert")).toHaveTextContent(
          "Preferences failed",
        );
      await waitFor(() => expect(preferencesButton()).toBeEnabled());
    },
  );
  it("account pending locks both saves until response", async () => {
    const pending = deferred<unknown>();
    const net = network({
      "PUT /api/v1/profile/account": () => pending.promise,
    });
    const props = settings();
    fireEvent.submit(accountForm());
    expect(preferencesButton()).toBeDisabled();
    preferencesButton().click();
    expect(props.onPreferencesUpdated).not.toHaveBeenCalled();
    pending.resolve({ profile: apiProfile, token });
    await waitFor(() => expect(props.onProfileUpdated).toHaveBeenCalledOnce());
    expect(net.fetch).toHaveBeenCalledOnce();
  });
  it("user typing cannot extend name beyond 100", async () => {
    settings();
    change(field("changeDisplayName"), "x".repeat(100));
    await userEvent
      .setup({ delay: null })
      .type(field("changeDisplayName"), "extra");
    expect(field("changeDisplayName")).toHaveValue("x".repeat(100));
  });
});
