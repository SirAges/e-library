import { NextFunction, Response, Request as ExpressRequest } from "express";
import { verifyToken } from "../services/token.service";
import { JWT_SECRET } from "../config/env";
import { JwtPayload } from "jsonwebtoken";
import { Roles } from "../lib/enums";

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
        error: true,
        message: `You are not authorized to perform this request.`,
      });
      return;
    }

    const headerToken = headerAuthorization.split(" ")[1];
    if (!headerToken) {
      res.status(403).json({
        error: true,
        message: `Your authorization token must be a beerer token.`,
      });
      return;
    }

    const decodedToken = verifyToken(headerToken, JWT_SECRET!) as JwtPayload;
    if (!decodedToken) {
      res.status(403).json({
        error: true,
        message: `Your authorization token does not contain any payload.`,
      });
      return;
    }

    req.user = {
      userId: decodedToken.userId,
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
  const user = req.user!;
  console.log("user", user);
  if (!user) {
    res.status(401).json({
      error: true,
      message: "You are not authenticated",
    });
    return;
  }
  if (!user?.role) {
    res.status(400).json({
      error: true,
      message: `There is an issue with your account. Please contact La book`,
    });
    return;
  }
  try {
    if (user?.role !== Roles.ADMIN) {
      res.status(403).json({
        error: true,
        message: `You can not perform this action. You are not an admin`,
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
  const user = req.user!;
  if (!user) {
    res.status(401).json({
      error: true,
      message: "You are not authenticated",
    });
    return;
  }
  if (!user?.role) {
    res.status(400).json({
      error: true,
      message: `There is an issue with your account. Please contact La book`,
    });
    return;
  }
  try {
    if (user?.role !== Roles.LIBRARIAN) {
      res.status(403).json({
        error: true,
        message: `You can not perform this action. You are not a librarian`,
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
  const user = req.user!;
  if (!user) {
    res.status(401).json({
      error: true,
      message: "You are not authenticated",
    });
    return;
  }
  if (!user?.role) {
    res.status(400).json({
      error: true,
      message: `There is an issue with your account. Please contact La book`,
    });
    return;
  }
  try {
    if (user?.role !== Roles.LIBRARIAN && user?.role !== Roles.ADMIN) {
      res.status(403).json({
        error: true,
        message: `You can not perform this action. You are not a librarian`,
      });
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
};
