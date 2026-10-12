import express from "express";
import router from "./routes/api.routes.js";
import requestLogger from "./middleware/request-logger.js";
import errorHandler from "./middleware/error-handler.js";
import { NotFoundError } from "./errors/errors.js";

const app = express();

app.use(requestLogger);

app.use(express.json());

app.use(router);

app.use(() => {
  throw new NotFoundError("Route not found");
});

app.use(errorHandler);

export default app;
