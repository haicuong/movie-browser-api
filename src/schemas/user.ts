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

export const UserEmailSchema = zod
  .email("Invalid email format")
  .min(1, "Email is required");

export const UserNameSchema = zod
  .string()
  .min(2, "Name must be at least 2 characters long")
  .max(50, "Name must be at most 50 characters long");
