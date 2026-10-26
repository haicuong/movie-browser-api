import express from "express";
import listFavorites from "../controllers/list-favorites.controller.js";
import getFavorite from "../controllers/get-favorite.controller.js";
import createFavorite from "../controllers/create-favorite.controller.js";
import replaceFavorite from "../controllers/replace-favorite.controller.js";
import deleteFavorite from "../controllers/delete-favorite.controller.js";

const router = express.Router();

router.get("/health", (req, res) => {
  return res.status(200).json({ status: "ok" });
});
router.get("/favorites", listFavorites);
router.get("/favorites/:tmdbId", getFavorite);
router.post("/favorites", createFavorite);
router.put("/favorites/:tmdbId", replaceFavorite);
router.delete("/favorites/:tmdbId", deleteFavorite);

export default router;
