import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import * as policy from "../src/contexts/authentication/domain/passwordPolicy.ts";

const require = createRequire(import.meta.url);

test("shows password requirements only while a password is entered", () => {
  let form = {
    displayName: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  };
  let stateIndex = 0;
  let passwordChange;

  // Isolate the registration render without a browser or registration requests.
  const dependencies = {
    react: {
      ...React,
      useState(initial) {
        const index = stateIndex++;
        return [
          index === 2 ? form : initial,
          (value) => {
            if (index === 2)
              form = typeof value === "function" ? value(form) : value;
          },
        ];
      },
    },
    "../../../i18n/LanguageProvider": {
      useLanguage: () => ({ t: (key) => key }),
    },
    "../../../infrastructure/auth/authService": {
      register: () => assert.fail("Rendering must not register an account"),
    },
    "../../../shared/ui/Spinner": { Spinner: () => null },
    "./AuthLayout": {
      AuthLayout: ({ children }) =>
        React.createElement(React.Fragment, null, children),
    },
    "../../../shared/ui/PasswordField": {
      PasswordField: ({ label: _label, ...props }) => {
        if (props.id === "web-register-password")
          passwordChange = props.onChange;
        return React.createElement("input", props);
      },
    },
    "../domain/passwordPolicy": policy,
    "../../../infrastructure/config/legal": {
      PRIVACY_POLICY_URL: "https://example.invalid/policy.pdf",
    },
  };
  const source = readFileSync(
    new URL(
      "../src/contexts/authentication/presentation/RegisterPage.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const exports = {};
  runInNewContext(compiled, {
    exports,
    require: (name) => dependencies[name] ?? require(name),
  });
  const render = () => {
    stateIndex = 0;
    return renderToStaticMarkup(
      React.createElement(exports.RegisterPage, {
        onBack() {},
        onRegistered() {},
      }),
    );
  };
  const assertHidden = (html) => {
    assert(!html.includes('id="register-password-requirements"'));
    assert(!html.includes('aria-describedby="register-password-requirements"'));
  };

  assertHidden(render());
  passwordChange({ target: { value: "A" } });
  let html = render();
  assert(html.includes('id="register-password-requirements"'));
  assert(html.includes('aria-describedby="register-password-requirements"'));
  assert.equal((html.match(/class="requirement-met"/g) ?? []).length, 1);
  assert.equal((html.match(/class="requirement-pending"/g) ?? []).length, 4);
  assert.equal((html.match(/>check_circle<\/span>/g) ?? []).length, 1);
  assert.equal((html.match(/>cancel<\/span>/g) ?? []).length, 4);

  passwordChange({ target: { value: "SafeSpace1!" } });
  html = render();
  assert.equal((html.match(/class="requirement-met"/g) ?? []).length, 5);
  assert.equal((html.match(/>check_circle<\/span>/g) ?? []).length, 5);
  assert(!html.includes('class="requirement-pending"'));
  assert(!html.includes(">cancel</span>"));

  passwordChange({ target: { value: "" } });
  assertHidden(render());
});
