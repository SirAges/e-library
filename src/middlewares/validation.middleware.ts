import { NextFunction, Request, Response } from "express";
import * as z from "zod";

export const validateSignIn = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const schema = z.object({
    email: z.string(),
    password: z.string(),
  });
  try {
    schema.parse(req.body);
    next();
  } catch (error) {
    next(error);
  }
};

export const validateSignUp = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const schema = z.object({
    email: z.string(),
    password: z.string(),
    lastName: z.string(),
    firstName: z.string(),
  });
  try {
    console.log('req.body', req.body)
    schema.parse(req.body);
    next();
  } catch (error) {
    next(error);
  }
};

export const validateVerifyOtp = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const schema = z.object({
    email: z.string(),
    otp: z.string(),
  });
  try {
    schema.parse(req.body);
    next();
  } catch (error) {
    next(error);
  }
};

export const validateBookCreation = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const schema = z.object({
    title: z.string().min(3),
    isbn: z.string().min(3),
    author: z.string().min(3),
    series: z.string().min(3),
    publisher: z.string().min(3),
    edition: z.string().min(3),
    language: z.string().min(2),
    genre: z.string().min(3),
    year: z.coerce.number(),
    copies: z.coerce.number(),
    description: z.string().min(3),
    summary: z.string().min(3),
    pages: z.coerce.number(),
    bookFormat: z.string().min(3),
    callNumber: z.string().min(3),
  });
  try {
    schema.parse(req.body);
    next();
  } catch (error) {
    next(error);
  }
};

export const borrowBookValidation = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const schema = z.object({
    bookId: z.number(),
  });
  try {
    schema.parse(req.body);
    next();
  } catch (error) {
    next(error);
  }
};

export const reviewBookValidation = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const schema = z.object({
    rating: z.number(),
    comment: z.string(),
  });

  try {
    schema.parse(req.body);
    next();
  } catch (error) {
    next(error);
  }
};
