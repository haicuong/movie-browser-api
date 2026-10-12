import type { NextFunction, Request, Response } from "express";

let requestIdCounter = 0;

export default function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  res.locals.id = requestIdCounter++;
  res.locals.startTime = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - res.locals.startTime;
    console.log(
      `Request ${res.locals.id}: ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`,
    );
  });
  next();
}
