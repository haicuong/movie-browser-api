import { Request, Response } from "express";
import { NotFoundError } from "../errors/errors.js";
import { getAuthenticatedUserId } from "../middleware/auth.js";
import { Prisma } from "../prisma/generated/client.js";
import { prisma } from "../prisma/prisma.js";
import { validateStringMovieId } from "../validation/movie.js";

export default async function deleteFavorite(
  req: Request<{ tmdbId: string }>,
  res: Response,
) {
  const userId = getAuthenticatedUserId(req);
  const { tmdbId } = req.params;
  const parsedId = validateStringMovieId(tmdbId);

  try {
    await prisma.favorite.delete({
      where: {
        userId_tmdbId: {
          userId,
          tmdbId: parsedId,
        },
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw new NotFoundError(
        `Movie with ID ${parsedId} not found in user's favorites`,
      );
    }

    throw error;
  }

  return res.sendStatus(204);
}
