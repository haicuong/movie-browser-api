import { Request, Response } from "express";
import { getAuthenticatedUserId } from "../middleware/auth.js";
import { prisma } from "../prisma/prisma.js";
import { validatePaginationQuery } from "../validation/user.js";

interface FavoriteMovieRow {
  tmdbId: number;
  title: string;
  overview: string;
  posterPath: string | null;
}

export default async function listFavorites(
  req: Request<{}, {}, {}, { page?: string; limit?: string }>,
  res: Response,
) {
  const userId = getAuthenticatedUserId(req);
  const { page, limit } = validatePaginationQuery(req.query);
  const offset = (page - 1) * limit;

  const movies = await prisma.$queryRaw<FavoriteMovieRow[]>`
    SELECT
      m.tmdb_id AS "tmdbId",
      m.title,
      m.overview,
      m.poster_path AS "posterPath"
    FROM favorites f
    INNER JOIN movies m ON m.tmdb_id = f.tmdb_id
    WHERE f.user_id = ${userId}
    ORDER BY f.created_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  return res.status(200).json(movies);
}
