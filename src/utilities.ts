import { Request } from "express";
import { Movie } from "./types/movie.js";
import { NotFoundError, ValidationError } from "./errors/errors.js";
import { prisma } from "./prisma/prisma.js";

export function validateMovieId(id: number): number | undefined {
  if (typeof id !== "number" || isNaN(id) || id <= 0) {
    return undefined;
  }
  return id;
}

export function validateStringMovieId(id: string): number {
  console.log("Validating movie ID:", id);
  const parsedId = validateMovieId(parseInt(id, 10));
  if (!parsedId) {
    throw new ValidationError("Invalid movie ID");
  } else return parsedId;
}

export function validatePageNumber(page: string | undefined): number {
  if (page === undefined || page === null || page === "") {
    return 1;
  }

  const parsedPage = parseInt(page, 10);
  if (isNaN(parsedPage) || parsedPage <= 0) {
    throw new ValidationError("Invalid page number");
  }
  return parsedPage;
}

export function validateMovie(movie: Movie): Movie {
  if (
    !(movie instanceof Object) ||
    movie.tmdbId === undefined ||
    movie.title === undefined ||
    movie.overview === undefined ||
    movie.poster_path === undefined ||
    !validateMovieId(movie.tmdbId) ||
    typeof movie.title !== "string" ||
    typeof movie.overview !== "string" ||
    (movie.poster_path !== null && typeof movie.poster_path !== "string")
  ) {
    throw new ValidationError("Invalid movie request body");
  }
  return movie;
}

export function validateUserEmail(email: string): string | undefined {
  if (email.trim() === "" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return undefined;
  }
  return email;
}

export function validateUserName(name: string): string | undefined {
  if (name.trim() === "" || name.length < 2 || name.length > 50) {
    return undefined;
  }
  return name;
}

export function validateUser(req: Request): {
  validatedEmail: string;
  validatedName: string;
} {
  const userEmail = req.headers["user-email"] as string;
  const userName = req.headers["user-name"] as string;

  const validatedEmail = validateUserEmail(userEmail);
  const validatedName = validateUserName(userName);

  if (!validatedEmail) {
    throw new ValidationError("Invalid user email header");
  }

  if (!validatedName) {
    throw new ValidationError("Invalid user name header");
  }

  return {
    validatedEmail,
    validatedName,
  };
}

export async function getDBUser({
  email,
  name,
}: {
  email: string;
  name: string;
}) {
  return await prisma.user.findFirst({
    where: {
      email,
      name,
    },
  });
}

export async function getCertainDBUser({
  email,
  name,
}: {
  email: string;
  name: string;
}) {
  const user = await getDBUser({ email, name });
  if (!user) {
    throw new NotFoundError(`User not found`);
  }
  return user;
}
