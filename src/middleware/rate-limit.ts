import { rateLimit } from "express-rate-limit";
import env from "../config/env.js";

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

function createRateLimiter(options: {
  limit: number;
  message: string;
  skipInTest?: boolean;
}) {
  return rateLimit({
    windowMs: FIFTEEN_MINUTES_MS,
    limit: options.limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    ...(options.skipInTest ? { skip: () => env.nodeEnv === "test" } : {}),
    message: {
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: options.message,
      },
    },
  });
}

export const appLimiter = createRateLimiter({
  limit: 100,
  message: "Too many requests, please try again later.",
});

export const authLimiter = createRateLimiter({
  limit: 15,
  message: "Too many authentication attempts, please try again later.",
  // Prevent test suites sharing loopback IP from hitting 429 across auth cases.
  skipInTest: true,
});
