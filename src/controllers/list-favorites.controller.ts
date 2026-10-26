import { Request, Response } from "express";
import {
  getCertainDBUser,
  validatePageNumber,
  validateUser,
} from "../utilities.js";
import { prisma } from "../prisma/prisma.js";

export default async function listFavorites(req: Request, res: Response) {
  const { validatedEmail, validatedName } = validateUser(req);

  const { page } = req.query;

  const validatedPage = validatePageNumber(page as string);

  const user = await getCertainDBUser({
    email: validatedEmail,
    name: validatedName,
  });

  const favorites = await prisma.favorite.findMany({
    where: {
      userId: user.id,
    },
    take: 20,
    skip: (validatedPage - 1) * 20,
    orderBy: {
      createdAt: "desc",
    },
    include: {
      movie: true,
    },
  });

  return res.status(200).json(favorites);
}
