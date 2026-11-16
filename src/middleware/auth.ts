import type { NextFunction, Request, Response } from "express";
import { AUTH_COOKIE_NAME } from "../config/cookies.js";
import { UnauthorizedError } from "../errors/errors.js";
import { verifyAuthToken } from "../services/auth.js";

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[AUTH_COOKIE_NAME];
  if (typeof token !== "string" || token.length === 0) {
    throw new UnauthorizedError("Authentication required");
  }

  const { userId } = verifyAuthToken(token);
  req.userId = userId;
  next();
}

export function getAuthenticatedUserId(req: Request): number {
  if (!req.userId) {
    throw new UnauthorizedError("Authentication required");
  }
  return req.userId;
}
