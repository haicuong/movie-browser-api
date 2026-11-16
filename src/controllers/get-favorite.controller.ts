import { Request, Response } from "express";
import { NotFoundError } from "../errors/errors.js";
import { getAuthenticatedUserId } from "../middleware/auth.js";
import { prisma } from "../prisma/prisma.js";
import { validateStringMovieId } from "../validation/movie.js";

export default async function getFavorite(
  req: Request<{ tmdbId: string }>,
  res: Response,
) {
  const userId = getAuthenticatedUserId(req);
  const { tmdbId } = req.params;
  const parsedId = validateStringMovieId(tmdbId);

  const favorite = await prisma.favorite.findUnique({
    where: {
      userId_tmdbId: {
        userId,
        tmdbId: parsedId,
      },
    },
    include: {
      movie: true,
    },
  });

  if (!favorite) {
    throw new NotFoundError(`Movie with ID ${parsedId} not found in favorites`);
  }

  return res.status(200).json(favorite.movie);
}
