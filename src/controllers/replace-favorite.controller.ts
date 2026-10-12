import { Request, Response } from "express";
import { favorites } from "../data/favorites.js";
import { NotFoundError, ValidationError } from "../errors/errors.js";
import { validateMovie, validateMovieId } from "../utilities.js";
import { Movie } from "../types/movie.js";

export default function replaceFavorite(
  req: Request<{ id: string }, {}, Movie>,
  res: Response,
) {
  const { id } = req.params;
  const parsedId = validateMovieId(id);
  if (!parsedId) {
    throw new ValidationError("Invalid movie ID");
  }

  const movieIndex = favorites.findIndex((movie) => movie.id === parsedId);

  if (movieIndex === -1) {
    throw new NotFoundError(`Movie with ID ${parsedId} not found in favorites`);
  }

  const newMovie = validateMovie(req.body);

  if (!newMovie) {
    throw new ValidationError("Invalid request body");
  }

  if (newMovie.id !== parsedId) {
    throw new ValidationError(
      "Movie ID in the body does not match the ID in the URL",
    );
  }

  favorites[movieIndex] = newMovie;

  return res.status(200).json(favorites[movieIndex]);
}
