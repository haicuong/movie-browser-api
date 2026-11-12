import express from "express";
import router from "./routes/api.routes.js";
import requestLogger from "./middleware/request-logger.js";
import errorHandler from "./middleware/error-handler.js";
import { NotFoundError } from "./errors/errors.js";
import helmet from "helmet";
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

app.use(helmet());

app.use(requestLogger);

app.use(limiter);

app.use(express.json({ limit: "10kb" }));

app.use(router);

app.use(() => {
  throw new NotFoundError("Route not found");
});

app.use(errorHandler);

export default app;
