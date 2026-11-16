import * as zod from "zod";

export const PaginationQuerySchema = zod.object({
  page: zod.preprocess(
    (val) => (val === undefined || val === null || val === "" ? 1 : val),
    zod.coerce
      .number()
      .int()
      .positive("Page number must be a positive integer"),
  ),
  limit: zod.preprocess(
    (val) => (val === undefined || val === null || val === "" ? 20 : val),
    zod.coerce.number().int().positive("Limit must be a positive integer"),
  ),
});

export const NormalizedEmailSchema = zod
  .string()
  .trim()
  .toLowerCase()
  .pipe(zod.email("Invalid email format"));

export const RegisterSchema = zod.object({
  email: NormalizedEmailSchema,
  password: zod
    .string()
    .min(8, "Password must be at least 8 characters long")
    .max(128, "Password must be at most 128 characters long"),
});

export const LoginSchema = zod.object({
  email: NormalizedEmailSchema,
  password: zod
    .string()
    .min(1, "Password is required")
    .max(128, "Password must be at most 128 characters long"),
});

export type AuthCredentials = zod.infer<typeof RegisterSchema>;

// Legacy schemas retained temporarily until Phase 5 removes header-based auth.
export const UserEmailSchema = zod
  .email("Invalid email format")
  .min(1, "Email is required");

export const UserNameSchema = zod
  .string()
  .min(2, "Name must be at least 2 characters long")
  .max(50, "Name must be at most 50 characters long");
