import { NextFunction, Response, Request as ExpressRequest } from "express";
import { verifyToken } from "../services/token.service";
import { JWT_SECRET } from "../config/env";
import { JwtPayload } from "jsonwebtoken";

interface Request extends ExpressRequest {
  user?: {
    userId: number;
    email: string;
    role: string;
  };
}

export const userAuthorization = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const headerAuthorization = req.headers["authorization"];
    if (!headerAuthorization) {
      res.status(403).json({
        success: false,
        error: true,
        message: `You are not authorized to perform this request.`,
        data: null,
      });
      return;
    }

    const headerToken = headerAuthorization.split(" ")[1];
    if (!headerToken) {
      res.status(403).json({
        success: false,
        error: true,
        message: `Your authorization token must be a beerer token.`,
        data: null,
      });
      return;
    }

    const decodedToken = verifyToken(headerToken, JWT_SECRET!) as JwtPayload;
    if (!decodedToken) {
      res.status(403).json({
        success: false,
        error: true,
        message: `Your authorization token does not contain any payload.`,
        data: null,
      });
      return;
    }

    req.user = {
      userId: decodedToken.id,
      role: decodedToken.role,
      email: decodedToken.email,
    };

    next();
  } catch (error) {
    next(error);
  }
};

export const adminAuthorization = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { role } = req.user!;
  if (!role) {
    res.status(400).json({
      success: false,
      error: true,
      message: `There is an issue with your account. Please contact La book`,
      data: null,
    });
    return;
  }
  try {
    if (role !== "ADMIN") {
      res.status(403).json({
        success: false,
        error: true,
        message: `You can not perform this action. You are not an admin`,
        data: null,
      });
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
};

export const librarianAuthorization = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { role } = req.user!;
  if (!role) {
    res.status(400).json({
      success: false,
      error: true,
      message: `There is an issue with your account. Please contact La book`,
      data: null,
    });
    return;
  }
  try {
    if (role !== "LIBRARIAN") {
      res.status(403).json({
        success: false,
        error: true,
        message: `You can not perform this action. You are not a librarian`,
        data: null,
      });
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
};

export const adminAndLibrarianAuthorization = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { role } = req.user!;
  if (!role) {
    res.status(400).json({
      success: false,
      error: true,
      message: `There is an issue with your account. Please contact La book`,
      data: null,
    });
    return;
  }
  try {
    if (role !== "LIBRARIAN" && role !== "ADMIN") {
      res.status(403).json({
        success: false,
        error: true,
        message: `You can not perform this action. You are not a librarian`,
        data: null,
      });
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
};
