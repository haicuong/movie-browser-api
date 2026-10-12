import { Movie } from "./types/movie.js";

export function validateMovieId(id: string): number | undefined {
  if (id.trim() === "" || !/^[-+]?\d+$/.test(id)) return undefined;

  const parsedId = parseInt(id, 10);

  if (isNaN(parsedId) || parsedId <= 0) return undefined;

  return parsedId;
}

export function validateMovie(movie: Movie): Movie | undefined {
  if (
    !(movie instanceof Object) ||
    movie.id === undefined ||
    movie.title === undefined ||
    movie.overview === undefined ||
    movie.poster_path === undefined ||
    !validateMovieId(movie.id.toString()) ||
    typeof movie.title !== "string" ||
    typeof movie.overview !== "string" ||
    (movie.poster_path !== null && typeof movie.poster_path !== "string")
  ) {
    return undefined;
  }
  return movie;
}
