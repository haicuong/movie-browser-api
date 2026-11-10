import { Request, Response } from "express";
import { getCertainDBUser } from "../utilities.js";
import { prisma } from "../prisma/prisma.js";
import { validatePaginationQuery, validateUser } from "../validation/user.js";

export default async function listFavorites(
  req: Request<{}, {}, {}, { page?: string; limit?: string }>,
  res: Response,
) {
  const { validatedEmail, validatedName } = validateUser(req);

  const { page, limit } = validatePaginationQuery(req.query);

  const user = await getCertainDBUser({
    email: validatedEmail,
    name: validatedName,
  });

  const favorites = await prisma.favorite.findMany({
    where: {
      userId: user.id,
    },
    take: limit,
    skip: (page - 1) * limit,
    orderBy: {
      createdAt: "desc",
    },
    include: {
      movie: true,
    },
  });

  return res.status(200).json(favorites.map((favorite) => favorite.movie));
}
