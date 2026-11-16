import { Request, Response } from "express";
import { getAuthenticatedUserId } from "../middleware/auth.js";
import { prisma } from "../prisma/prisma.js";
import { validatePaginationQuery } from "../validation/user.js";

export default async function listFavorites(
  req: Request<{}, {}, {}, { page?: string; limit?: string }>,
  res: Response,
) {
  const userId = getAuthenticatedUserId(req);
  const { page, limit } = validatePaginationQuery(req.query);

  const favorites = await prisma.favorite.findMany({
    where: {
      userId,
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
