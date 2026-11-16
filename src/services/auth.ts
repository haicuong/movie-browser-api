import { argon2id, hash, verify } from "argon2";
import type { Response } from "express";
import jwt from "jsonwebtoken";
import { AUTH_COOKIE_NAME, getAuthCookieOptions } from "../config/cookies.js";
import env from "../config/env.js";
import { UnauthorizedError } from "../errors/errors.js";

export async function hashPassword(password: string): Promise<string> {
  return hash(password, { type: argon2id });
}

export async function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  return verify(passwordHash, password);
}

export function signAuthToken(userId: number): string {
  return jwt.sign({ userId }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as jwt.SignOptions["expiresIn"],
  });
}

export function verifyAuthToken(token: string): { userId: number } {
  let decoded: string | jwt.JwtPayload;
  try {
    decoded = jwt.verify(token, env.jwtSecret);
  } catch {
    throw new UnauthorizedError("Invalid or expired authentication token");
  }

  if (
    typeof decoded !== "object" ||
    decoded === null ||
    typeof decoded.userId !== "number" ||
    !Number.isInteger(decoded.userId) ||
    decoded.userId <= 0
  ) {
    throw new UnauthorizedError("Invalid authentication token");
  }

  return { userId: decoded.userId };
}

export function issueAuthCookie(res: Response, userId: number): void {
  const token = signAuthToken(userId);
  res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());
}
