import { Request } from "express";
import { UnauthorizedError, ValidationError } from "../errors/errors.js";
import {
  PaginationQuerySchema,
  UserEmailSchema,
  UserNameSchema,
} from "../schemas/user.js";

export function validatePaginationQuery(query: unknown): {
  page: number;
  limit: number;
} {
  const parsedQuery = PaginationQuerySchema.safeParse(query);
  if (!parsedQuery.success) {
    throw new ValidationError("Invalid pagination query parameters");
  }
  return parsedQuery.data;
}

export function validateUserEmail(email: unknown): string {
  const parsedEmail = UserEmailSchema.safeParse(email);
  if (!parsedEmail.success) {
    throw new ValidationError("Invalid email format");
  }
  return parsedEmail.data;
}

export function validateUserName(name: unknown): string {
  const parsedName = UserNameSchema.safeParse(name);
  if (!parsedName.success) {
    throw new ValidationError("Invalid name format");
  }
  return parsedName.data;
}

export function validateUser(req: Request): {
  validatedEmail: string;
  validatedName: string;
} {
  const userEmail = req.headers["user-email"] as string;
  const userName = req.headers["user-name"] as string;

  let validatedEmail: string;
  let validatedName: string;
  try {
    validatedEmail = validateUserEmail(userEmail);
    validatedName = validateUserName(userName);
  } catch (error) {
    if (error instanceof ValidationError) {
      throw new UnauthorizedError("Invalid user credentials");
    } else {
      throw error;
    }
  }

  return {
    validatedEmail,
    validatedName,
  };
}
