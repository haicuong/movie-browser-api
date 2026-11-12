import { Request, Response } from "express";
import { AppError, DuplicateError, NotFoundError } from "../errors/errors.js";
import { Movie } from "../schemas/movie.js";
import { getDBUser } from "../utilities.js";
import { prisma } from "../prisma/prisma.js";
import { Prisma } from "../prisma/generated/client.js";
import { validateMovie, validateStringMovieId } from "../validation/movie.js";
import { validateUser } from "../validation/user.js";
import tmdbRequest from "../services/tmdb-proxy.js";

export default async function createFavorite(
  req: Request<{ tmdbId: string }>,
  res: Response,
) {
  //TODO: remove this temporary user and implement authentication.
  const { validatedEmail, validatedName } = validateUser(req);

  const { tmdbId } = req.params;
  const parsedId = validateStringMovieId(tmdbId);

  let movie: Movie;

  const dbMovie = await prisma.movie.findUnique({
    where: { tmdbId: parsedId },
  });

  if (!dbMovie) {
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

    movie = {
      tmdbId: parsedId,
      title: tmdbResponse.body.title,
      poster_path: tmdbResponse.body.poster_path ?? null,
      overview: tmdbResponse.body.overview || "No overview available.",
    };

    const validatedMovie = validateMovie(movie);

    await prisma.movie.upsert({
      where: { tmdbId: validatedMovie.tmdbId },
      update: {
        title: validatedMovie.title,
        posterPath: validatedMovie.poster_path,
        overview: validatedMovie.overview,
      },
      create: {
        tmdbId: validatedMovie.tmdbId,
        title: validatedMovie.title,
        posterPath: validatedMovie.poster_path,
        overview: validatedMovie.overview,
      },
    });
  } else {
    movie = {
      tmdbId: dbMovie.tmdbId,
      title: dbMovie.title,
      poster_path: dbMovie.posterPath,
      overview: dbMovie.overview,
    };
  }

  const userInDB = await getDBUser({
    email: validatedEmail,
    name: validatedName,
  });

  if (!userInDB) {
    const user = await prisma.user.create({
      data: {
        email: validatedEmail,
        name: validatedName,
      },
    });

    await createFavoriteHandler(user.id, movie.tmdbId);
  } else {
    await createFavoriteHandler(userInDB.id, movie.tmdbId);
  }

  return res.status(201).json(movie);
}

async function createFavoriteHandler(userId: number, tmdbId: number) {
  try {
    const favorite = await prisma.favorite.create({
      data: {
        userId: userId,
        tmdbId: tmdbId,
      },
    });
    return favorite;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new DuplicateError("Favorite already exists");
    }

    throw error;
  }
}
