import { describe, it, expect, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { RegisterPage } from "../src/contexts/authentication/presentation/RegisterPage";
import { LoginPage } from "../src/contexts/authentication/presentation/LoginPage";
import {
  mount,
  field,
  button,
  change,
  submit,
  screen,
  waitFor,
  network,
  response,
  auth,
  deferred,
  t,
} from "./helpers";

function registration() {
  const onRegistered = vi.fn(),
    onBack = vi.fn();
  mount(<RegisterPage onRegistered={onRegistered} onBack={onBack} />);
  change(field("displayName"), " Ana Lima ");
  change(field("username"), " ana ");
  change(field("email"), "ana@example.test");
  change(field("password"), "Password1!");
  change(field("confirmPassword"), "Password1!");
  return { onRegistered, onBack };
}

describe("src/contexts/authentication/presentation/RegisterPage.tsx | integration", () => {
  it.each([
    ["empty name", "", "Password1!", "Password1!"],
    ["whitespace name", " \t ", "Password1!", "Password1!"],
    ["short password", "Ana", "Ab1!", "Ab1!"],
    ["no uppercase", "Ana", "password1!", "password1!"],
    ["no lowercase", "Ana", "PASSWORD1!", "PASSWORD1!"],
    ["no digit", "Ana", "Password!", "Password!"],
    ["no special", "Ana", "Password1", "Password1"],
    ["whitespace special", "Ana", "Password1 ", "Password1 "],
    ["UTF8 overflow", "Ana", "Ab1!" + "é".repeat(35), "Ab1!" + "é".repeat(35)],
    ["confirmation mismatch", "Ana", "Password1!", "Password2!"],
    ["empty confirmation", "Ana", "Password1!", ""],
  ])("blocks %s before fetch", async (_name, name, password, confirmation) => {
    const net = network({ "POST /api/v1/auth/register": auth });
    registration();
    change(field("displayName"), name);
    change(field("password"), password);
    change(field("confirmPassword"), confirmation);
    submit(field("password"));
    await waitFor(() => expect(net.fetch).not.toHaveBeenCalled());
  });
  it.each(["Password1!", "Árbol123!", "Ab1!" + "a".repeat(68)])(
    "accepts valid password %s through real service",
    async (password) => {
      const net = network({ "POST /api/v1/auth/register": auth });
      const { onRegistered } = registration();
      change(field("password"), password);
      change(field("confirmPassword"), password);
      submit(field("password"));
      await waitFor(() => expect(onRegistered).toHaveBeenCalledOnce());
      expect(net.mutations()[0].body).toEqual({
        display_name: "Ana Lima",
        username: "ana",
        email: "ana@example.test",
        password,
        confirm_password: password,
      });
      expect(net.mutations()[0].headers.Authorization).toBeUndefined();
    },
  );
  it.each([
    ["needs special character", "passwordRequirementsError"],
    ["Password exceeds 72", "passwordTooLong"],
    ["Passwords do not match", "passwordMismatch"],
    ["Username already exists", null],
  ])("maps API message %s", async (message, translation) => {
    network({ "POST /api/v1/auth/register": response({ message }, 400) });
    const { onRegistered } = registration();
    submit(field("password"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      translation ? t[translation as keyof typeof t] : message,
    );
    expect(onRegistered).not.toHaveBeenCalled();
    expect(button("registerAccount")).toBeEnabled();
  });
  it("clears previous error on editing and retries successfully", async () => {
    let attempt = 0;
    network({
      "POST /api/v1/auth/register": () =>
        ++attempt === 1 ? response({ message: "Try again" }, 503) : auth,
    });
    const { onRegistered } = registration();
    submit(field("password"));
    await screen.findByRole("alert");
    change(field("username"), "newname");
    expect(screen.queryByRole("alert")).toBeNull();
    submit(field("password"));
    await waitFor(() => expect(onRegistered).toHaveBeenCalledOnce());
  });
  it("pending submit guard prevents duplicate form events", async () => {
    const pending = deferred<unknown>();
    const net = network({
      "POST /api/v1/auth/register": () => pending.promise,
    });
    const { onRegistered } = registration();
    submit(field("password"));
    submit(field("password"));
    expect(net.fetch).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: new RegExp(t.registering) }),
    ).toBeDisabled();
    pending.resolve(auth);
    await waitFor(() => expect(onRegistered).toHaveBeenCalledOnce());
  });
  it("native required username prevents click submit", async () => {
    const net = network({ "POST /api/v1/auth/register": auth });
    registration();
    change(field("username"), "");
    fireClickSubmit();
    expect(field("username")).toBeInvalid();
    expect(net.fetch).not.toHaveBeenCalled();
  });
  it("native malformed email prevents click submit", async () => {
    const net = network({ "POST /api/v1/auth/register": auth });
    registration();
    change(field("email"), "invalid");
    fireClickSubmit();
    expect(field("email")).toBeInvalid();
    expect(net.fetch).not.toHaveBeenCalled();
  });
  it("typing beyond username maximum keeps 50 characters", async () => {
    network({ "POST /api/v1/auth/register": auth });
    registration();
    change(field("username"), "a".repeat(50));
    await userEvent.setup({ delay: null }).type(field("username"), "overflow");
    expect(field("username")).toHaveValue("a".repeat(50));
  });
});
function fireClickSubmit() {
  button("registerAccount").click();
}

function loginForm() {
  const onLogin = vi.fn(),
    onRegister = vi.fn();
  mount(<LoginPage onLogin={onLogin} onRegister={onRegister} />);
  change(field("usernameOrEmail"), "ana");
  change(field("password"), "Password1!");
  return { onLogin, onRegister };
}
describe("src/contexts/authentication/presentation/LoginPage.tsx | integration", () => {
  it.each([
    ["empty identifier", "", "Password1!"],
    ["whitespace identifier", " \t ", "Password1!"],
    ["empty password", "ana", ""],
  ])("blocks %s", (_name, identifier, password) => {
    const net = network({ "POST /api/v1/auth/login": auth });
    loginForm();
    change(field("usernameOrEmail"), identifier);
    change(field("password"), password);
    submit(field("password"));
    expect(net.fetch).not.toHaveBeenCalled();
  });
  it.each([
    ["username", "ana", "Password1!", "EMPLOYEE"],
    ["email", "ana@example.test", "Password1!", "EMPLOYEE"],
    ["trim identifier", " ana ", "Password1!", "EMPLOYEE"],
    ["HR role", "hr", "Password1!", "HR_MEMBER"],
    ["password preserved", "ana", " Password1! ", "EMPLOYEE"],
    ["old short password allowed", "ana", "old", "EMPLOYEE"],
    ["Unicode identifier", "Ána", "Password1!", "EMPLOYEE"],
  ])(
    "%s forwards exact credentials and mapped session",
    async (_name, identifier, password, role) => {
      const net = network({ "POST /api/v1/auth/login": { ...auth, role } });
      const { onLogin } = loginForm();
      change(field("usernameOrEmail"), identifier);
      change(field("password"), password);
      submit(field("password"));
      await waitFor(() =>
        expect(onLogin).toHaveBeenCalledWith({
          token: auth.token,
          username: auth.username,
          displayName: auth.display_name,
          userId: auth.user_id,
          role,
        }),
      );
      expect(net.mutations()[0].body).toEqual({
        identifier: identifier.trim(),
        password,
      });
    },
  );
  it("blocks system admin session from employee portal", async () => {
    network({ "POST /api/v1/auth/login": { ...auth, role: "SYSTEM_ADMIN" } });
    const { onLogin } = loginForm();
    submit(field("password"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      t.systemAdminPortal,
    );
    expect(onLogin).not.toHaveBeenCalled();
  });
  it.each(["ADMIN", null, ""])(
    "fails closed for unsupported server role %s",
    async (role) => {
      network({ "POST /api/v1/auth/login": { ...auth, role } });
      const { onLogin } = loginForm();
      submit(field("password"));
      expect(await screen.findByRole("alert")).toHaveTextContent(
        t.errorGeneric,
      );
      expect(onLogin).not.toHaveBeenCalled();
    },
  );
  it.each([400, 401, 403, 429, 500, 503])(
    "API failure %i never authenticates and allows retry",
    async (status) => {
      network({
        "POST /api/v1/auth/login": response(
          { message: "Login failed" },
          status,
        ),
      });
      const { onLogin } = loginForm();
      submit(field("password"));
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Login failed",
      );
      expect(onLogin).not.toHaveBeenCalled();
      expect(button("signIn")).toBeEnabled();
    },
  );
  it("pending disables second user click", async () => {
    const pending = deferred<unknown>();
    const net = network({ "POST /api/v1/auth/login": () => pending.promise });
    const { onLogin } = loginForm();
    button("signIn").click();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: new RegExp(t.signingIn) }),
      ).toBeDisabled(),
    );
    screen.getByRole("button", { name: new RegExp(t.signingIn) }).click();
    expect(net.fetch).toHaveBeenCalledOnce();
    pending.resolve(auth);
    await waitFor(() => expect(onLogin).toHaveBeenCalledOnce());
  });
  it("failed credentials can be corrected and retried", async () => {
    let n = 0;
    network({
      "POST /api/v1/auth/login": () =>
        ++n === 1 ? response({ message: "Bad credentials" }, 401) : auth,
    });
    const { onLogin } = loginForm();
    submit(field("password"));
    await screen.findByRole("alert");
    change(field("password"), "Correct1!");
    submit(field("password"));
    await waitFor(() => expect(onLogin).toHaveBeenCalledOnce());
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("native empty field prevents user submit", () => {
    const net = network({ "POST /api/v1/auth/login": auth });
    loginForm();
    change(field("password"), "");
    button("signIn").click();
    expect(field("password")).toBeInvalid();
    expect(net.fetch).not.toHaveBeenCalled();
  });
});
