import request from "supertest";
import { describe, expect, test } from "vitest";
import app from "../app.js";

describe("Security headers middleware", () => {
  test("sets OWASP REST API security headers and removes X-Powered-By", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.headers["x-powered-by"]).toBeUndefined();
    expect(response.headers["content-security-policy"]).toBe(
      "default-src 'none'; frame-ancestors 'none'",
    );
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("DENY");
    expect(response.headers["referrer-policy"]).toBe("no-referrer");
    expect(response.headers["cross-origin-opener-policy"]).toBe("same-origin");
    expect(response.headers["cross-origin-resource-policy"]).toBe("same-site");
    expect(response.headers["x-xss-protection"]).toBe("0");
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers["strict-transport-security"]).toBeUndefined();
  });
});
