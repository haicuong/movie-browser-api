import { argon2id, hash, verify } from "argon2";
import type { Response } from "express";
import jwt from "jsonwebtoken";
import { AUTH_COOKIE_NAME, getAuthCookieOptions } from "../config/cookies.js";
import env from "../config/env.js";
import { UnauthorizedError } from "../errors/errors.js";

const JWT_ALGORITHM: jwt.Algorithm = "HS256";

// Precomputed Argon2id digest matching default hash() params (m=65536, t=3, p=4)
// so unknown-email login attempts perform equivalent work without cold-start overhead.
export const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=65536,t=3,p=4$Z0hLwj2lk+MRR+ZE5FhNfw$R6NSiE9JVTOLrd7vA8lQjOeraY1bAbt2RAbzeicl0yI";

export async function hashPassword(password: string): Promise<string> {
  return hash(password, { type: argon2id });
}

export async function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  return verify(passwordHash, password);
}

export function signAuthToken(userId: number, tokenVersion: number): string {
  return jwt.sign({ userId, tokenVersion }, env.jwtSecret, {
    algorithm: JWT_ALGORITHM,
    expiresIn: env.jwtExpiresIn as jwt.SignOptions["expiresIn"],
  });
}

export function verifyAuthToken(token: string): {
  userId: number;
  tokenVersion: number;
} {
  let decoded: string | jwt.JwtPayload;
  try {
    decoded = jwt.verify(token, env.jwtSecret, {
      algorithms: [JWT_ALGORITHM],
    });
  } catch {
    throw new UnauthorizedError("Invalid or expired authentication token");
  }

  if (
    typeof decoded !== "object" ||
    decoded === null ||
    typeof decoded.userId !== "number" ||
    !Number.isInteger(decoded.userId) ||
    decoded.userId <= 0 ||
    typeof decoded.tokenVersion !== "number" ||
    !Number.isInteger(decoded.tokenVersion) ||
    decoded.tokenVersion <= 0
  ) {
    throw new UnauthorizedError("Invalid authentication token");
  }

  return {
    userId: decoded.userId,
    tokenVersion: decoded.tokenVersion,
  };
}

export function issueAuthCookie(
  res: Response,
  userId: number,
  tokenVersion: number,
): void {
  const token = signAuthToken(userId, tokenVersion);
  res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());
}
