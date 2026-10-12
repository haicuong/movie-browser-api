import { Request, Response } from "express";
import { favorites } from "../app.js";

export default function listFavorites(req: Request, res: Response) {
  return res.status(200).json(favorites);
}
