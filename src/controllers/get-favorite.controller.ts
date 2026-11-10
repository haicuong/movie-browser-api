import { Request, Response } from "express";
import { getCertainDBUser } from "../utilities.js";
import { NotFoundError, ValidationError } from "../errors/errors.js";
import { prisma } from "../prisma/prisma.js";
import { validateStringMovieId } from "../validation/movie.js";
import { validateUser } from "../validation/user.js";

export default async function getFavorite(
  req: Request<{ tmdbId: string }>,
  res: Response,
) {
  const { validatedEmail, validatedName } = validateUser(req);

  const user = await getCertainDBUser({
    email: validatedEmail,
    name: validatedName,
  });

  const { tmdbId } = req.params;
  const parsedId = validateStringMovieId(tmdbId);

  const favorite = await prisma.favorite.findUnique({
    where: {
      userId_tmdbId: {
        userId: user.id,
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
