import type { Request, Response } from "express";
import { AUTH_COOKIE_NAME, getAuthCookieClearOptions } from "../config/cookies.js";
import { DuplicateError, UnauthorizedError } from "../errors/errors.js";
import { getAuthenticatedUserId } from "../middleware/auth.js";
import { Prisma } from "../prisma/generated/client.js";
import { prisma } from "../prisma/prisma.js";
import {
  DUMMY_PASSWORD_HASH,
  hashPassword,
  issueAuthCookie,
  verifyPassword,
} from "../services/auth.js";
import {
  validateLoginBody,
  validateRegisterBody,
} from "../validation/user.js";

const PUBLIC_USER_SELECT = {
  id: true,
  email: true,
  createdAt: true,
} as const;

export async function register(req: Request, res: Response) {
  const { email, password } = validateRegisterBody(req.body);
  const passwordHash = await hashPassword(password);

  try {
    const user = await prisma.user.create({
      data: { email, passwordHash },
      select: PUBLIC_USER_SELECT,
    });

    issueAuthCookie(res, user.id);
    return res.status(201).json(user);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new DuplicateError("Email is already registered");
    }
    throw error;
  }
}

export async function login(req: Request, res: Response) {
  const { email, password } = validateLoginBody(req.body);

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      ...PUBLIC_USER_SELECT,
      passwordHash: true,
    },
  });

  const passwordValid = await verifyPassword(
    user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    password,
  );

  if (!user || !passwordValid) {
    throw new UnauthorizedError("Invalid email or password");
  }

  issueAuthCookie(res, user.id);
  return res.status(200).json({
    id: user.id,
    email: user.email,
    createdAt: user.createdAt,
  });
}

export function logout(_req: Request, res: Response) {
  res.clearCookie(AUTH_COOKIE_NAME, getAuthCookieClearOptions());
  return res.sendStatus(204);
}

export async function getMe(req: Request, res: Response) {
  const userId = getAuthenticatedUserId(req);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: PUBLIC_USER_SELECT,
  });

  if (!user) {
    res.clearCookie(AUTH_COOKIE_NAME, getAuthCookieClearOptions());
    throw new UnauthorizedError("User no longer exists");
  }

  return res.status(200).json(user);
}
