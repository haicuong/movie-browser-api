import { Request, Response } from "express";
import { NotFoundError } from "../errors/errors.js";
import { getAuthenticatedUserId } from "../middleware/auth.js";
import { prisma } from "../prisma/prisma.js";
import { validateStringMovieId } from "../validation/movie.js";

interface FavoriteMovieRow {
  tmdbId: number;
  title: string;
  overview: string;
  posterPath: string | null;
}

export default async function getFavorite(
  req: Request<{ tmdbId: string }>,
  res: Response,
) {
  const userId = getAuthenticatedUserId(req);
  const { tmdbId } = req.params;
  const parsedId = validateStringMovieId(tmdbId);

  const rows = await prisma.$queryRaw<FavoriteMovieRow[]>`
    SELECT
      m.tmdb_id AS "tmdbId",
      m.title,
      m.overview,
      m.poster_path AS "posterPath"
    FROM favorites f
    INNER JOIN movies m ON m.tmdb_id = f.tmdb_id
    WHERE f.user_id = ${userId} AND f.tmdb_id = ${parsedId}
    LIMIT 1
  `;

  const movie = rows[0];
  if (!movie) {
    throw new NotFoundError(`Movie with ID ${parsedId} not found in favorites`);
  }

  return res.status(200).json(movie);
}
