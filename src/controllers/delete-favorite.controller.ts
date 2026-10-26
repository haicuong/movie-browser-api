import { Request, Response } from "express";
import { NotFoundError } from "../errors/errors.js";
import {
  getCertainDBUser,
  validateStringMovieId,
  validateUser,
} from "../utilities.js";
import { prisma } from "../prisma/prisma.js";
import { Prisma } from "../prisma/generated/client.js";

export default async function deleteFavorite(
  req: Request<{ tmdbId: string }>,
  res: Response,
) {
  const { tmdbId } = req.params;
  const parsedId = validateStringMovieId(tmdbId);

  const { validatedEmail, validatedName } = validateUser(req);

  const user = await getCertainDBUser({
    email: validatedEmail,
    name: validatedName,
  });

  try {
    await prisma.favorite.delete({
      where: {
        userId_tmdbId: {
          userId: user.id,
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
