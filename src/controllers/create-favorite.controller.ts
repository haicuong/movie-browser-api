import { Request, Response } from "express";
import { favorites } from "../data/favorites.js";
import { DuplicateError, ValidationError } from "../errors/errors.js";
import { Movie } from "../types/movie.js";
import {
  validateMovie,
  validateUserEmail,
  validateUserName,
} from "../utilities.js";
import { prisma } from "../prisma/prisma.js";
import { Prisma } from "../prisma/generated/client.js";

export default async function createFavorite(
  req: Request<{}, {}, Movie>,
  res: Response,
) {
  //TODO: Authentication and authorization should be implemented
  const userEmail = req.headers["user-email"] as string;
  const userName = req.headers["user-name"] as string;

  const validatedEmail = validateUserEmail(userEmail);
  if (!validatedEmail) {
    throw new ValidationError("Invalid user email header");
  }

  const validatedName = validateUserName(userName);
  if (!validatedName) {
    throw new ValidationError("Invalid user name header");
  }

  const validatedMovie = validateMovie(req.body);
  if (!validatedMovie) {
    throw new ValidationError("Invalid request body");
  }

  const userInDB = await prisma.user.findFirst({
    where: {
      email: validatedEmail,
      name: validatedName,
    },
  });

  if (!userInDB) {
    const user = await prisma.user.create({
      data: {
        email: validatedEmail,
        name: validatedName,
      },
    });

    await createFavoriteHandler(user.id, validatedMovie.id);
  } else {
    await createFavoriteHandler(userInDB.id, validatedMovie.id);
  }

  const newMovie: Movie = {
    id: validatedMovie.id,
    title: validatedMovie.title,
    poster_path: validatedMovie.poster_path,
    overview: validatedMovie.overview,
  };

  await prisma.movie.upsert({
    where: { tmdbId: validatedMovie.id },
    update: {
      title: validatedMovie.title,
      posterPath: validatedMovie.poster_path,
      overview: validatedMovie.overview,
    },
    create: {
      tmdbId: validatedMovie.id,
      title: validatedMovie.title,
      posterPath: validatedMovie.poster_path,
      overview: validatedMovie.overview,
    },
  });

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

    throw new Error("Failed to create favorite");
  }
}
