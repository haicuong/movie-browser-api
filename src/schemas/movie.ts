import * as zod from "zod";

export const MovieIdSchema = zod.preprocess((value) => {
  if (typeof value === "string") {
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed)) {
      return parsed;
    }
  }
  return value;
}, zod.number().int().positive("Movie ID must be a positive integer"));

export const MovieSchema = zod.object({
  tmdbId: MovieIdSchema,
  title: zod.string().min(1, "Title is required"),
  overview: zod.string().min(1, "Overview is required"),
  poster_path: zod.string().nullable(),
});

export type Movie = zod.infer<typeof MovieSchema>;
