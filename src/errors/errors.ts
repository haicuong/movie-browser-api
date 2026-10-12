export class AppError extends Error {
  httpStatus: number;
  errorCode: string;
  constructor(message: string, errorCode: string, httpStatus: number) {
    super(message);
    this.name = this.constructor.name;
    this.errorCode = errorCode;
    this.httpStatus = httpStatus;
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = "Resource not found") {
    super(message, "NOT_FOUND", 404);
  }
}

export class ValidationError extends AppError {
  constructor(message: string = "Validation error") {
    super(message, "VALIDATION_ERROR", 400);
  }
}

export class DuplicateError extends AppError {
  constructor(message: string = "Duplicate resource") {
    super(message, "DUPLICATE_ERROR", 409);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "Unauthorized") {
    super(message, "UNAUTHORIZED", 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = "Forbidden") {
    super(message, "FORBIDDEN", 403);
  }
}
