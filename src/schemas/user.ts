import * as zod from "zod";

const MAX_PAGE = 10_000;
const MAX_LIMIT = 100;

function createPaginationIntSchema(
  defaultValue: number,
  max: number,
  label: string,
) {
  return zod.preprocess(
    (val) => {
      if (val === undefined || val === null || val === "") {
        return defaultValue;
      } else if (typeof val === "number") {
        return val;
      } else if (typeof val === "string" && /^\d+$/.test(val)) {
        return Number(val);
      }
      return NaN;
    },
    zod
      .number(`${label} must be a positive integer`)
      .int(`${label} must be a positive integer`)
      .min(1, `${label} must be a positive integer`)
      .max(max, `${label} must be at most ${max}`),
  );
}

export const PaginationQuerySchema = zod.strictObject({
  page: createPaginationIntSchema(1, MAX_PAGE, "Page number"),
  limit: createPaginationIntSchema(20, MAX_LIMIT, "Limit"),
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
