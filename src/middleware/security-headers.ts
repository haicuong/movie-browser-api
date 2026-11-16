import type { NextFunction, Request, Response } from "express";
import env from "../config/env.js";

const API_CSP = "default-src 'none'; frame-ancestors 'none'";
const API_PERMISSIONS_POLICY = [
  "accelerometer=()",
  "ambient-light-sensor=()",
  "autoplay=()",
  "battery=()",
  "camera=()",
  "cross-origin-isolated=()",
  "display-capture=()",
  "document-domain=()",
  "encrypted-media=()",
  "fullscreen=()",
  "geolocation=()",
  "gyroscope=()",
  "keyboard-map=()",
  "magnetometer=()",
  "microphone=()",
  "midi=()",
  "payment=()",
  "picture-in-picture=()",
  "publickey-credentials-get=()",
  "screen-wake-lock=()",
  "sync-xhr=()",
  "usb=()",
  "web-share=()",
  "xr-spatial-tracking=()",
].join(", ");

const STATIC_SECURITY_HEADERS: ReadonlyArray<readonly [string, string]> = [
  ["Content-Security-Policy", API_CSP],
  ["X-Content-Type-Options", "nosniff"],
  ["X-Frame-Options", "DENY"],
  ["Referrer-Policy", "no-referrer"],
  ["Permissions-Policy", API_PERMISSIONS_POLICY],
  ["Cross-Origin-Opener-Policy", "same-origin"],
  ["Origin-Agent-Cluster", "?1"],
  ["X-DNS-Prefetch-Control", "off"],
  ["X-Permitted-Cross-Domain-Policies", "none"],
  ["X-XSS-Protection", "0"],
  ["Cache-Control", "no-store"],
];

export default function securityHeaders(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  for (const [header, value] of STATIC_SECURITY_HEADERS) {
    res.setHeader(header, value);
  }

  res.setHeader(
    "Cross-Origin-Resource-Policy",
    env.isProduction && env.cookieSameSite === "none"
      ? "cross-origin"
      : "same-site",
  );

  // Only emit HSTS in production HTTPS so plain http://localhost dev/test is unaffected.
  if (env.isProduction) {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains",
    );
  }

  next();
}
