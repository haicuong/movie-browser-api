import { Request, Response } from "express";
import { favorites } from "../data/favorites.js";

export default function listFavorites(req: Request, res: Response) {
  return res.status(200).json(favorites);
}
