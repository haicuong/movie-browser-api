import { Request, Response } from "express";
import { favorites } from "../data/favorites.js";
import { NotFoundError, ValidationError } from "../errors/errors.js";
import { validateStringMovieId } from "../utilities.js";

export default function deleteFavorite(
  req: Request<{ id: string }>,
  res: Response,
) {
  const { id } = req.params;
  const parsedId = validateStringMovieId(id);

  if (!parsedId) {
    throw new ValidationError("Invalid movie ID");
  }

  const movieIndex = favorites.findIndex((movie) => movie.id === parsedId);

  if (movieIndex === -1) {
    throw new NotFoundError(`Movie with ID ${parsedId} not found in favorites`);
  }

  favorites.splice(movieIndex, 1);

  return res.sendStatus(204);
}
