import express, { type RequestHandler } from "express";
import env from "./config/env.js";
import router from "./routes/api.routes.js";
import requestLogger from "./middleware/request-logger.js";
import errorHandler from "./middleware/error-handler.js";
import { NotFoundError } from "./errors/errors.js";
import * as helmetPkg from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { appLimiter } from "./middleware/rate-limit.js";

function resolveHelmet(): () => RequestHandler {
  let mod: unknown = helmetPkg;
  while (
    mod &&
    typeof mod !== "function" &&
    typeof mod === "object" &&
    "default" in mod
  ) {
    mod = (mod as { default: unknown }).default;
  }
  if (typeof mod !== "function") {
    throw new Error("Failed to resolve helmet middleware");
  }
  return mod as () => RequestHandler;
}

const helmet = resolveHelmet();

const app = express();

app.set("trust proxy", 1);

app.use(helmet());

app.use(
  cors({
    origin: env.corsOrigins,
    credentials: true,
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  }),
);

app.use(cookieParser());

app.use(requestLogger);

app.use(appLimiter);

app.use(express.json({ limit: "10kb" }));

app.use(router);

app.use(() => {
  throw new NotFoundError("Route not found");
});

app.use(errorHandler);

export default app;
