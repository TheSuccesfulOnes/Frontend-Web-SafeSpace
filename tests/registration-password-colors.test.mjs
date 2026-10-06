import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

function luminance(hex) {
  const [r, g, b] = hex.match(/[a-f\d]{2}/gi).map((channel) => {
    const value = parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

test("password status indicators contrast with light and dark surfaces", () => {
  const tokens = readFileSync(
    new URL("../src/index.css", import.meta.url),
    "utf8",
  );
  for (const selector of [":root", ':root[data-theme="dark"]']) {
    const body = tokens.slice(tokens.indexOf(`${selector} {`)).split("}")[0];
    const token = (name) =>
      body.match(new RegExp(`--${name}: (#[a-f\\d]{6});`, "i"))[1];
    const background = luminance(token("panel"));
    for (const state of ["success", "danger"]) {
      const foreground = luminance(token(state));
      const contrast =
        (Math.max(foreground, background) + 0.05) /
        (Math.min(foreground, background) + 0.05);
      assert(
        contrast >= 4.5,
        `${state} in ${selector}: ${contrast.toFixed(2)}:1`,
      );
    }
  }
});
