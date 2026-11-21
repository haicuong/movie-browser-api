import { Request, Response } from "express";
import {
  AUTH_COOKIE_NAME,
  getAuthCookieClearOptions,
} from "../config/cookies.js";
import {
  AppError,
  DuplicateError,
  NotFoundError,
  UnauthorizedError,
} from "../errors/errors.js";
import { getAuthenticatedUserId } from "../middleware/auth.js";
import { Prisma } from "../prisma/generated/client.js";
import { prisma } from "../prisma/prisma.js";
import { Movie } from "../schemas/movie.js";
import tmdbRequest from "../services/tmdb-proxy.js";
import { validateMovie, validateStringMovieId } from "../validation/movie.js";

const inFlightMovieLookups = new Map<number, Promise<Movie>>();

async function fetchAndCacheMovie(parsedId: number): Promise<Movie> {
  const existingLookup = inFlightMovieLookups.get(parsedId);
  if (existingLookup) {
    return existingLookup;
  }

  const lookupPromise = (async () => {
    const tmdbResponse = await tmdbRequest(`/movie/${parsedId}`);
    if (!tmdbResponse.success) {
      if (tmdbResponse.statusCode === 404) {
        throw new NotFoundError(`Movie with ID ${parsedId} not found in TMDB`);
      }
      throw new AppError(
        `Failed to fetch movie data from TMDB: ${tmdbResponse.error}`,
        "BAD_GATEWAY",
        502,
      );
    }

    const movie: Movie = {
      tmdbId: parsedId,
      title: tmdbResponse.body.title,
      posterPath: tmdbResponse.body.poster_path ?? null,
      overview: tmdbResponse.body.overview || "No overview available.",
    };

    const validatedMovie = validateMovie(movie);

    await prisma.movie.upsert({
      where: { tmdbId: validatedMovie.tmdbId },
      update: {
        title: validatedMovie.title,
        posterPath: validatedMovie.posterPath,
        overview: validatedMovie.overview,
      },
      create: {
        tmdbId: validatedMovie.tmdbId,
        title: validatedMovie.title,
        posterPath: validatedMovie.posterPath,
        overview: validatedMovie.overview,
      },
    });

    return validatedMovie;
  })();

  inFlightMovieLookups.set(parsedId, lookupPromise);

  try {
    return await lookupPromise;
  } finally {
    if (inFlightMovieLookups.get(parsedId) === lookupPromise) {
      inFlightMovieLookups.delete(parsedId);
    }
  }
}

export default async function createFavorite(
  req: Request<{ tmdbId: string }>,
  res: Response,
) {
  const userId = getAuthenticatedUserId(req);

  const { tmdbId } = req.params;
  const parsedId = validateStringMovieId(tmdbId);

  let movie: Movie;

  const dbMovie = await prisma.movie.findUnique({
    where: { tmdbId: parsedId },
  });

  if (!dbMovie) {
    movie = await fetchAndCacheMovie(parsedId);
  } else {
    movie = {
      tmdbId: dbMovie.tmdbId,
      title: dbMovie.title,
      posterPath: dbMovie.posterPath,
      overview: dbMovie.overview,
    };
  }

  try {
    await prisma.favorite.create({
      data: {
        userId,
        tmdbId: movie.tmdbId,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        throw new DuplicateError("Favorite already exists");
      }
      if (error.code === "P2003") {
        res.clearCookie(AUTH_COOKIE_NAME, getAuthCookieClearOptions());
        throw new UnauthorizedError("User no longer exists");
      }
    }

    throw error;
  }

  return res.status(201).json(movie);
}
