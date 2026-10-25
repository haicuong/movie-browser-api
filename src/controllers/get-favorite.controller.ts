import { Request, Response } from "express";
import { favorites } from "../data/favorites.js";
import { validateStringMovieId } from "../utilities.js";
import { NotFoundError, ValidationError } from "../errors/errors.js";

export default function getFavorite(
  req: Request<{ id: string }>,
  res: Response,
) {
  const { id } = req.params;
  const parsedId = validateStringMovieId(id);
  if (!parsedId) {
    throw new ValidationError("Invalid movie ID");
  }

  const movie = favorites.find((movie) => movie.id === parsedId);

  if (!movie) {
    throw new NotFoundError(`Movie with ID ${parsedId} not found in favorites`);
  }

  return res.status(200).json(movie);
}
