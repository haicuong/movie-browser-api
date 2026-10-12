import express, { NextFunction, type Request, type Response } from "express";
import type { Movie } from "./types/movie.d.ts";
import {
  AppError,
  DuplicateError,
  NotFoundError,
  ValidationError,
} from "./errors/errors.js";
import listFavorites from "./controllers/listFavorites.js";
import getFavorite from "./controllers/getFavorite.js";
import createFavorite from "./controllers/createFavorite.js";
import replaceFavorite from "./controllers/replaceFavorite.js";
import deleteFavorite from "./controllers/deleteFavorite.js";

export const favorites: Movie[] = [];

const app = express();

app.use(express.json());

app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

app.get("/health", (req: Request, res: Response) => {
  return res.status(200).json({ status: "ok" });
});

app.get("/favorites", listFavorites);

app.get("/favorites/:id", getFavorite);

app.post("/favorites", createFavorite);

app.put("/favorites/:id", replaceFavorite);

app.delete("/favorites/:id", deleteFavorite);

app.use((req: Request, res: Response, next: NextFunction) => {
  next(new NotFoundError("Route not found"));
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof AppError) {
    return res.status(err.httpStatus).json({
      error: {
        code: err.errorCode,
        message: err.message,
      },
    });
  }

  console.error(err);

  return res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Internal Server Error",
    },
  });
});

export default app;
