import dotenv from "dotenv";
import * as zod from "zod";

// Load .env as a fallback for standalone scripts; existing process.env keys win.
dotenv.config({ path: [".env.local", ".env"], quiet: true });

const EnvSchema = zod
  .object({
    NODE_ENV: zod
      .enum(["development", "production", "test"])
      .default("development"),
    PORT: zod.preprocess(
      (val) => (val === undefined || val === null || val === "" ? 3000 : val),
      zod.coerce.number().int().min(1).max(65535),
    ),
    JWT_SECRET: zod
      .string()
      .trim()
      .min(16, "JWT_SECRET must be at least 16 characters"),
    JWT_EXPIRES_IN: zod.string().trim().min(1).default("7d"),
    CORS_ORIGIN: zod
      .string()
      .trim()
      .min(1, "CORS_ORIGIN is required")
      .transform((val) =>
        val
          .split(",")
          .map((origin) => origin.trim().replace(/\/+$/, ""))
          .filter(Boolean),
      )
      .refine((origins) => origins.length > 0, {
        message: "CORS_ORIGIN must contain at least one origin",
      })
      .refine((origins) => !origins.includes("*"), {
        message: "CORS_ORIGIN cannot be '*' when credentials are enabled",
      }),
    TMDB_TOKEN: zod.string().trim().min(1, "TMDB_TOKEN is required"),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === "production" && data.JWT_SECRET.length < 32) {
      ctx.addIssue({
        code: "custom",
        path: ["JWT_SECRET"],
        message: "JWT_SECRET must be at least 32 characters in production",
      });
    }
  });

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid environment configuration: ${details}`);
}

const env = {
  nodeEnv: parsed.data.NODE_ENV,
  port: parsed.data.PORT,
  jwtSecret: parsed.data.JWT_SECRET,
  jwtExpiresIn: parsed.data.JWT_EXPIRES_IN,
  corsOrigins: parsed.data.CORS_ORIGIN,
  tmdbToken: parsed.data.TMDB_TOKEN,
  isProduction: parsed.data.NODE_ENV === "production",
} as const;

export default env;
