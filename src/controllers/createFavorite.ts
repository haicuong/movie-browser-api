import { Request, Response } from "express";
import { favorites } from "../app.js";
import { DuplicateError, ValidationError } from "../errors/errors.js";
import { Movie } from "../types/movie.js";
import { validateMovie, validateMovieId } from "../utilities.js";

export default function createFavorite(
  req: Request<{}, {}, Movie>,
  res: Response,
) {
  const validatedMovie = validateMovie(req.body);

  if (!validatedMovie) {
    throw new ValidationError("Invalid request body");
  }

  const parsedId = validateMovieId(validatedMovie.id.toString());

  if (!parsedId) {
    throw new ValidationError("Invalid movie ID");
  }

  if (favorites.some((movie) => movie.id === parsedId)) {
    throw new DuplicateError(
      `Movie with ID ${parsedId} already exists in favorites`,
    );
  }

  const newMovie: Movie = {
    id: parsedId,
    title: validatedMovie.title,
    poster_path: validatedMovie.poster_path,
    overview: validatedMovie.overview,
  };

  favorites.push(newMovie);

  return res.status(201).json(newMovie);
}
