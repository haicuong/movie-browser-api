import type {
  NextFunction,
  Request,
  Response,
  ErrorRequestHandler,
} from "express";
import { AppError } from "../errors/errors.js";

interface BodyParserError extends SyntaxError {
  status?: number;
  body?: string;
  type?: string;
}

interface PayloadTooLargeError extends Error {
  expected?: number;
  length?: number;
  limit?: number;
  type?: string;
  status?: number;
  statusCode?: number;
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

function isPayloadTooLargeError(err: Error): err is PayloadTooLargeError {
  return (
    typeof (err as PayloadTooLargeError).expected === "number" &&
    typeof (err as PayloadTooLargeError).length === "number" &&
    typeof (err as PayloadTooLargeError).limit === "number" &&
    ((err as PayloadTooLargeError).type === "entity.too.large" ||
      (err as PayloadTooLargeError).status === 413 ||
      (err as PayloadTooLargeError).statusCode === 413)
  );
}

export default function errorHandler(
  err: Error,
  _: Request,
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
  } else if (isPayloadTooLargeError(err)) {
    return res.status(413).json({
      error: "Payload Too Large",
      message: "Request body cannot exceed 10KB.",
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
