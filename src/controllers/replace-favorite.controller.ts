import { Request, Response } from "express";
import { favorites } from "../data/favorites.js";
import { NotFoundError, ValidationError } from "../errors/errors.js";
import {
  getCertainDBUser,
  validateMovie,
  validateStringMovieId,
  validateUser,
} from "../utilities.js";
import { Movie } from "../types/movie.js";
import { prisma } from "../prisma/prisma.js";

export default async function replaceFavorite(
  req: Request<{ tmdbId: string }, {}, Movie>,
  res: Response,
) {
  const { validatedEmail, validatedName } = validateUser(req);

  const user = await getCertainDBUser({
    email: validatedEmail,
    name: validatedName,
  });

  const { tmdbId } = req.params;
  const parsedId = validateStringMovieId(tmdbId);

  const newMovie = validateMovie(req.body);

  if (newMovie.tmdbId !== parsedId) {
    throw new ValidationError(
      "Movie ID in the body does not match the ID in the URL",
    );
  }

  const favorite = await prisma.favorite.findUnique({
    where: {
      userId_tmdbId: {
        userId: user.id,
        tmdbId: parsedId,
      },
    },
  });

  if (!favorite) {
    throw new NotFoundError(`Favorite with ID ${parsedId} not found`);
  }

  const movie = await prisma.movie.upsert({
    where: { tmdbId: newMovie.tmdbId },
    update: {
      title: newMovie.title,
      posterPath: newMovie.poster_path,
      overview: newMovie.overview,
    },
    create: {
      tmdbId: newMovie.tmdbId,
      title: newMovie.title,
      posterPath: newMovie.poster_path,
      overview: newMovie.overview,
    },
  });

  return res.status(200).json(movie);
}
