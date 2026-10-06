import assert from "node:assert/strict";
import { test } from "node:test";
import { isRegistrationPasswordValid } from "../src/contexts/authentication/domain/passwordPolicy.ts";

test("accepts valid registration passwords with accents and symbols", () => {
  for (const password of ["Password1!", "Árbol123!", "SafeSpace1🔒"]) {
    assert.equal(isRegistrationPasswordValid(password), true);
  }
});

test("rejects missing requirements and whitespace as a special character", () => {
  for (const password of [
    "Ab1!",
    "password1!",
    "PASSWORD1!",
    "Password!",
    "Password1",
    "Password1 ",
    "Password1\u00a0",
  ]) {
    assert.equal(isRegistrationPasswordValid(password), false);
  }
});

test("enforces the BCrypt UTF-8 byte limit", () => {
  assert.equal(isRegistrationPasswordValid("Ab1!" + "a".repeat(68)), true);
  assert.equal(isRegistrationPasswordValid("Ab1!" + "a".repeat(69)), false);
  assert.equal(isRegistrationPasswordValid("Áb1!" + "é".repeat(34)), false);
});
