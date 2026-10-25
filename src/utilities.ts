import { Movie } from "./types/movie.js";

export function validateMovieId(id: number): number | undefined {
  if (typeof id !== "number" || isNaN(id) || id <= 0) {
    return undefined;
  }
  return id;
}

export function validateStringMovieId(id: string): number | undefined {
  const parsedId = validateMovieId(parseInt(id, 10));
  if (!parsedId) {
    return undefined;
  } else return parsedId;
}

export function validateMovie(movie: Movie): Movie | undefined {
  if (
    !(movie instanceof Object) ||
    movie.id === undefined ||
    movie.title === undefined ||
    movie.overview === undefined ||
    movie.poster_path === undefined ||
    !validateMovieId(movie.id) ||
    typeof movie.title !== "string" ||
    typeof movie.overview !== "string" ||
    (movie.poster_path !== null && typeof movie.poster_path !== "string")
  ) {
    return undefined;
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
