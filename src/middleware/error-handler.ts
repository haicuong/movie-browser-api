import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/errors.js";

interface BodyParserError extends SyntaxError {
  status?: number;
  body?: string;
  type?: string;
}

function isBodyParserError(err: Error): err is BodyParserError {
  return (
    err instanceof SyntaxError &&
    typeof (err as BodyParserError).status === "number" &&
    (err as BodyParserError).status === 400 &&
    typeof (err as BodyParserError).body === "string" &&
    typeof (err as BodyParserError).type === "string"
  );
}

export default function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (res.headersSent) {
    return next(err);
  }

  if (isBodyParserError(err)) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid JSON payload",
      },
    });
  } else if (err instanceof AppError) {
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
}
