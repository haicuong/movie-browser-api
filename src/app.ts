import express from "express";
import env from "./config/env.js";
import router from "./routes/api.routes.js";
import requestLogger from "./middleware/request-logger.js";
import errorHandler from "./middleware/error-handler.js";
import { NotFoundError } from "./errors/errors.js";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: "Too many requests, please try again later.",
  },
});

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

app.use(limiter);

app.use(express.json({ limit: "10kb" }));

app.use(router);

app.use(() => {
  throw new NotFoundError("Route not found");
});

app.use(errorHandler);

export default app;
