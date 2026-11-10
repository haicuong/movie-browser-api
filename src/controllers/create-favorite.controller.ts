import { Request, Response } from "express";
import { DuplicateError } from "../errors/errors.js";
import { Movie } from "../types/movie.js";
import { getDBUser, validateMovie, validateUser } from "../utilities.js";
import { prisma } from "../prisma/prisma.js";
import { Prisma } from "../prisma/generated/client.js";

export default async function createFavorite(
  req: Request<{}, {}, Movie>,
  res: Response,
) {
  //TODO: remove this temporary user and implement authentication.
  const { validatedEmail, validatedName } = validateUser(req);

  const validatedMovie = validateMovie(req.body);

  const newMovie: Movie = {
    tmdbId: validatedMovie.tmdbId,
    title: validatedMovie.title,
    poster_path: validatedMovie.poster_path,
    overview: validatedMovie.overview,
  };

  //TODO: THIS IS A BUG, THIS CHANGE MOVIE DATA APPLIED TO ALL USERS.
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

    await createFavoriteHandler(user.id, validatedMovie.tmdbId);
  } else {
    await createFavoriteHandler(userInDB.id, validatedMovie.tmdbId);
  }

  return res.status(201).json(newMovie);
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
