import type { CookieOptions } from "express";
import env from "./env.js";

export const AUTH_COOKIE_NAME = "token";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function getAuthCookieClearOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: env.isProduction ? env.cookieSameSite : "lax",
    path: "/",
  };
}

export function getAuthCookieOptions(): CookieOptions {
  return {
    ...getAuthCookieClearOptions(),
    maxAge: SEVEN_DAYS_MS,
  };
}
