import express from "express";
import { getMe, login, logout, register } from "../controllers/auth.controller.js";
import createFavorite from "../controllers/create-favorite.controller.js";
import deleteFavorite from "../controllers/delete-favorite.controller.js";
import getFavorite from "../controllers/get-favorite.controller.js";
import listFavorites from "../controllers/list-favorites.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { authLimiter } from "../middleware/rate-limit.js";

const router = express.Router();

router.get("/health", (_, res) => {
  return res.status(200).json({ status: "ok" });
});

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.post("/logout", logout);
router.get("/me", requireAuth, getMe);

router.get("/favorites", requireAuth, listFavorites);
router.get("/favorites/:tmdbId", requireAuth, getFavorite);
router.post("/favorites/:tmdbId", requireAuth, createFavorite);
router.delete("/favorites/:tmdbId", requireAuth, deleteFavorite);

export default router;
