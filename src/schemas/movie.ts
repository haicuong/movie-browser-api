import * as zod from "zod";

const PG_INT4_MAX = 2_147_483_647;

export const MovieIdSchema = zod.preprocess(
  (value) => {
    if (typeof value === "string") {
      if (!/^\d+$/.test(value)) {
        return NaN;
      }
      return Number(value);
    }
    return value;
  },
  zod
    .number()
    .int("Movie ID must be a positive integer")
    .min(1, "Movie ID must be a positive integer")
    .max(PG_INT4_MAX, "Movie ID must be a 32-bit positive integer"),
);

export const MovieSchema = zod.object({
  tmdbId: MovieIdSchema,
  title: zod.string().min(1, "Title is required"),
  overview: zod.string().min(1, "Overview is required"),
  poster_path: zod.string().nullable(),
});

export type Movie = zod.infer<typeof MovieSchema>;
