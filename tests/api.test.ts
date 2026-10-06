import { describe, it, expect, vi } from "vitest";
import {
  apiRequest,
  ApiError,
  isUnauthorized,
} from "../src/infrastructure/api/apiClient";
import { network, response } from "./helpers";

describe("src/infrastructure/api/apiClient.ts | unit", () => {
  it.each([401, 403, 400, 404, 409, 422, 429, 500])(
    "status %i carries error metadata and auth classification",
    async (status) => {
      network({
        "GET /test": response(
          { message: "failure", code: "TEST_ERROR" },
          status,
        ),
      });
      const error = await apiRequest("/test").catch((error) => error);
      expect(error).toBeInstanceOf(ApiError);
      if (!(error instanceof ApiError)) throw error;
      expect(error.message).toBe("failure");
      expect(error.status).toBe(status);
      expect(error.code).toBe("TEST_ERROR");
      expect(isUnauthorized(error)).toBe(status === 401 || status === 403);
    },
  );
  it.each([
    null,
    {},
    { message: 2, code: 3 },
    { message: {}, code: null },
    ["bad"],
    "bad",
  ])("invalid error payload %j uses safe fallback", async (payload) => {
    network({ "GET /test": response(payload, 400) });
    await expect(apiRequest("/test")).rejects.toMatchObject({
      message: "No se pudo completar la solicitud.",
      code: undefined,
    });
  });
  it("non-JSON error uses fallback", async () => {
    network({ "GET /test": new Response("<html>", { status: 502 }) });
    await expect(apiRequest("/test")).rejects.toBeInstanceOf(ApiError);
  });
  it("non-JSON successful response returns null", async () => {
    network({ "GET /test": new Response("invalid") });
    expect(await apiRequest("/test")).toBeNull();
  });
  it("204 requires no JSON body", async () => {
    network({ "DELETE /test": response(null, 204) });
    expect(await apiRequest("/test", { method: "DELETE" })).toBeUndefined();
  });
  it("anonymous request sends no bearer or content type", async () => {
    const net = network({ "GET /test": {} });
    await apiRequest("/test");
    expect(net.calls[0].headers).toEqual({ Accept: "application/json" });
  });
  it("JSON request sends token and content type", async () => {
    const net = network({ "POST /test": {} });
    await apiRequest("/test", { method: "POST", body: "{}", token: "fake" });
    expect(net.calls[0].headers).toMatchObject({
      Authorization: "Bearer fake",
      "Content-Type": "application/json",
    });
  });
  it("custom headers explicitly override defaults", async () => {
    const net = network({ "GET /test": {} });
    await apiRequest("/test", { headers: { Accept: "custom" } });
    expect(net.calls[0].headers.Accept).toBe("custom");
  });
  it("network failure preserved", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    await expect(apiRequest("/test")).rejects.toThrow("offline");
  });
  it("lookalike errors cannot trigger authorization", () => {
    expect(isUnauthorized({ status: 401 })).toBe(false);
    expect(isUnauthorized(new Error("403"))).toBe(false);
    expect(isUnauthorized(null)).toBe(false);
  });
});
