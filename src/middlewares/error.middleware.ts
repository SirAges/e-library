import { NextFunction, Request, Response } from "express";
import {
  PrismaClientInitializationError,
  PrismaClientKnownRequestError,
  PrismaClientRustPanicError,
  PrismaClientUnknownRequestError,
  PrismaClientValidationError,
} from "@prisma/client/runtime/library";
import { NODE_ENV } from "../config/env";
import { ZodError, ZodInvalidTypeIssue } from "zod";
import logger from "../services/logger.service";

const errorMiddleware = (
  err:
    | Error
    | PrismaClientKnownRequestError
    | PrismaClientValidationError
    | PrismaClientUnknownRequestError
    | PrismaClientInitializationError
    | PrismaClientRustPanicError
    | ZodError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction // Ensure Express recognizes this as error middleware
) => {
  let statusCode = 500;
  let message = "An unexpected error occurred.";

  // Handle Prisma Known Errors
  if (err instanceof PrismaClientKnownRequestError) {
    statusCode = 400;
    const cause = err.meta?.cause || "A database error occurred.";
    const modelName =
      NODE_ENV === "development" && err.meta?.modelName
        ? ` (Model: ${err.meta.modelName})`
        : "";
    message = `${cause}${modelName}`;
  }

  // Handle JWT Errors
  else if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid authentication token.";
  } else if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Token expired. Please log in again.";
  }

  // Handle JSON Parsing Errors
  else if (err instanceof SyntaxError && "body" in err) {
    statusCode = 400;
    message = "Invalid JSON payload.";
  }
  if (err.name === "Not Found") {
    statusCode = 404;
    message = "Resource or Route not found";
  }
  if (err.name === "File Upload Error") {
    statusCode = 400;
    message = "No file uploaded";
  }
  if (err instanceof ZodError) {
    const firstError = err.errors[0];
    statusCode = 400;
    message = `Property ${firstError.path[0]}: ${firstError.message}`;
  }
  // Log full error details in development mode
  if (NODE_ENV !== "production") {
    console.error("Error details:", err);
  }
  logger.error(
    `Method: ${req.method}, Url: ${req.url}, StatusCode: ${statusCode}, Message: ${message}`
  );

  res.status(statusCode).json({
    success: false,
    error: true,
    message,
  });
};

export default errorMiddleware;
