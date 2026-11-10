import { ValidationError } from "../errors/errors.js";
import { type Movie, MovieSchema, MovieIdSchema } from "../schemas/movie.js";

export function validateMovie(movie: Movie): Movie {
  const result = MovieSchema.safeParse(movie);
  if (!result.success) {
    throw new ValidationError("Invalid movie request body");
  }
  return result.data;
}

export function validateStringMovieId(id: string): number {
  const parsedId = MovieIdSchema.safeParse(id);
  if (!parsedId.success) {
    throw new ValidationError("Invalid movie ID");
  } else return parsedId.data;
}
