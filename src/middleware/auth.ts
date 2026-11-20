import type { NextFunction, Request, Response } from "express";
import {
  AUTH_COOKIE_NAME,
  getAuthCookieClearOptions,
} from "../config/cookies.js";
import { UnauthorizedError } from "../errors/errors.js";
import { prisma } from "../prisma/prisma.js";
import { verifyAuthToken } from "../services/auth.js";

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const token = req.cookies?.[AUTH_COOKIE_NAME];
  if (typeof token !== "string" || token.length === 0) {
    throw new UnauthorizedError("Authentication required");
  }

  const { userId, tokenVersion } = verifyAuthToken(token);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      createdAt: true,
      tokenVersion: true,
    },
  });

  if (!user) {
    res.clearCookie(AUTH_COOKIE_NAME, getAuthCookieClearOptions());
    throw new UnauthorizedError("User no longer exists");
  }

  if (user.tokenVersion !== tokenVersion) {
    res.clearCookie(AUTH_COOKIE_NAME, getAuthCookieClearOptions());
    throw new UnauthorizedError("Invalid or expired authentication token");
  }

  req.userId = user.id;
  req.user = {
    id: user.id,
    email: user.email,
    createdAt: user.createdAt,
  };
  next();
}

export function getAuthenticatedUserId(req: Request): number {
  if (!req.userId) {
    throw new UnauthorizedError("Authentication required");
  }
  return req.userId;
}
