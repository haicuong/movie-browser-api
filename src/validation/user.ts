import * as zod from "zod";
import { ValidationError } from "../errors/errors.js";
import {
  type AuthCredentials,
  LoginSchema,
  PaginationQuerySchema,
  RegisterSchema,
} from "../schemas/user.js";

function parseWithSchema<T>(
  schema: zod.ZodType<T>,
  input: unknown,
  fallbackMessage: string,
): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const message = result.error.issues[0]?.message ?? fallbackMessage;
    throw new ValidationError(message);
  }
  return result.data;
}

export function validateRegisterBody(body: unknown): AuthCredentials {
  return parseWithSchema(RegisterSchema, body, "Invalid registration payload");
}

export function validateLoginBody(body: unknown): AuthCredentials {
  return parseWithSchema(LoginSchema, body, "Invalid login payload");
}

export function validatePaginationQuery(query: unknown): {
  page: number;
  limit: number;
} {
  return parseWithSchema(
    PaginationQuerySchema,
    query,
    "Invalid pagination query parameters",
  );
}
