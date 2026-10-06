import { describe, it, expect, vi } from "vitest";
import {
  isRegistrationPasswordValid as valid,
  passwordRequirements,
  passwordWithinLimit,
} from "../src/contexts/authentication/domain/passwordPolicy";
import {
  readSession,
  saveSession,
  clearSession,
} from "../src/infrastructure/auth/sessionStorage";
import {
  readLocalPreferences,
  saveLocalPreference,
} from "../src/infrastructure/preferences/preferenceStore";
import { session } from "./helpers";

describe("src/contexts/authentication/domain/passwordPolicy.ts | unit", () => {
  it.each([
    ["minimum eight", "Abcd12!x", true],
    ["seven codepoints", "Abcd1!x", false],
    ["no uppercase", "abcd12!x", false],
    ["no lowercase", "ABCD12!X", false],
    ["no digit", "Abcdef!x", false],
    ["no symbol", "Abcdef1x", false],
    ["space", "Abcdef1 ", false],
    ["NBSP", "Abcdef1\u00a0", false],
    ["newline", "Abcdef1\n", false],
    ["tab", "Abcdef1\t", false],
    ["control", "Abcdef1\0", false],
    ["format control", "Abcdef1\u200b", false],
    ["accent letters", "Árbol12!", true],
    ["Arabic decimal", "Abcdef١!", true],
    ["emoji symbol", "Abcdef1🔒", true],
    ["72 ASCII bytes", "Ab1!" + "x".repeat(68), true],
    ["73 ASCII bytes", "Ab1!" + "x".repeat(69), false],
    ["72 multibyte bytes", "Ab1!" + "é".repeat(34), true],
    ["74 multibyte bytes", "Ab1!" + "é".repeat(35), false],
    ["astral counts once", "Ab1!🔒🔒🔒", false],
    ["empty", "", false],
    ["letter numeral not decimal", "AbcdefⅧ!", false],
  ])("%s", (_name, password, expected) =>
    expect(valid(password)).toBe(expected),
  );
  it("returns independent requirement feedback", () =>
    expect(passwordRequirements("Ab1!")).toEqual({
      passwordMinimum: false,
      passwordUppercase: true,
      passwordLowercase: true,
      passwordNumber: true,
      passwordSpecial: true,
    }));
  it("byte ceiling independent of complexity", () =>
    expect(passwordWithinLimit("x".repeat(72))).toBe(true));
});

describe("src/infrastructure/auth/sessionStorage.ts | unit", () => {
  it.each([
    ["null", null],
    ["array", []],
    ["primitive", "token"],
    ["number", 1],
    ["empty object", {}],
    ["missing token", { ...session, token: undefined }],
    ["blank token", { ...session, token: " " }],
    ["numeric token", { ...session, token: 1 }],
    ["missing username", { ...session, username: undefined }],
    ["blank username", { ...session, username: " " }],
    ["numeric username", { ...session, username: 3 }],
    ["missing name", { ...session, displayName: undefined }],
    ["blank name", { ...session, displayName: "\t" }],
    ["wrong name type", { ...session, displayName: {} }],
    ["unknown role", { ...session, role: "ADMIN" }],
    ["missing role", { ...session, role: undefined }],
    ["string ID", { ...session, userId: "1" }],
    ["zero ID", { ...session, userId: 0 }],
    ["negative ID", { ...session, userId: -1 }],
    ["fraction ID", { ...session, userId: 1.5 }],
    ["unsafe ID", { ...session, userId: Number.MAX_SAFE_INTEGER + 1 }],
  ])("rejects %s and evicts invalid storage", (_name, value) => {
    sessionStorage.setItem("safespace.web.session", JSON.stringify(value));
    expect(readSession()).toBeNull();
    expect(sessionStorage.getItem("safespace.web.session")).toBeNull();
  });
  it.each(["EMPLOYEE", "HR_MEMBER", "SYSTEM_ADMIN"])(
    "roundtrips supported role %s",
    (role) => {
      saveSession({ ...session, role: role as typeof session.role });
      expect(readSession()).toEqual({ ...session, role });
    },
  );
  it("absent session", () => expect(readSession()).toBeNull());
  it("malformed JSON evicted", () => {
    sessionStorage.setItem("safespace.web.session", "{");
    expect(readSession()).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });
  it("clear preserves unrelated keys", () => {
    sessionStorage.setItem("other", "keep");
    saveSession(session);
    clearSession();
    expect(readSession()).toBeNull();
    expect(sessionStorage.getItem("other")).toBe("keep");
  });
  it("read error handled when removal is available", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readSession()).toBeNull();
  });
  it("read and eviction both blocked still fail closed", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readSession()).toBeNull();
  });
});

describe("src/infrastructure/preferences/preferenceStore.ts | unit", () => {
  it.each([
    ["es", "light", { language: "es", theme: "light" }],
    ["en", "dark", { language: "en", theme: "dark" }],
    ["en", "light", { language: "en", theme: "light" }],
    ["es", "dark", { language: "es", theme: "dark" }],
    ["ES", "dark", { theme: "dark" }],
    ["fr", "light", { theme: "light" }],
    [" en", "light", { theme: "light" }],
    ["en ", "dark", { theme: "dark" }],
    ["", "dark", { theme: "dark" }],
    ["null", "light", { theme: "light" }],
    ["es", "DARK", { language: "es" }],
    ["en", "system", { language: "en" }],
    ["es", " dark", { language: "es" }],
    ["en", "light ", { language: "en" }],
    ["es", "", { language: "es" }],
    ["<script>", "<img>", {}],
  ])("validates language=%s theme=%s", (language, theme, expected) => {
    saveLocalPreference(1, "language", language);
    saveLocalPreference(1, "theme", theme);
    expect(readLocalPreferences(1)).toEqual({
      language: undefined,
      theme: undefined,
      ...expected,
    });
  });
  it("missing preferences", () =>
    expect(readLocalPreferences(1)).toEqual({
      language: undefined,
      theme: undefined,
    }));
  it("isolates users", () => {
    saveLocalPreference(1, "theme", "dark");
    expect(readLocalPreferences(2).theme).toBeUndefined();
  });
  it("overwrites one preference only", () => {
    saveLocalPreference(1, "language", "en");
    saveLocalPreference(1, "theme", "dark");
    saveLocalPreference(1, "theme", "light");
    expect(readLocalPreferences(1)).toEqual({ language: "en", theme: "light" });
  });
  it("invalid persisted value becomes valid after correction", () => {
    saveLocalPreference(1, "language", "xx");
    expect(readLocalPreferences(1).language).toBeUndefined();
    saveLocalPreference(1, "language", "es");
    expect(readLocalPreferences(1).language).toBe("es");
  });
});
