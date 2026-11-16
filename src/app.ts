import express from "express";
import env from "./config/env.js";
import router from "./routes/api.routes.js";
import requestLogger from "./middleware/request-logger.js";
import errorHandler from "./middleware/error-handler.js";
import { NotFoundError } from "./errors/errors.js";
import * as helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { appLimiter } from "./middleware/rate-limit.js";

const app = express();

app.set("trust proxy", 1);

app.use(helmet.default());

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
