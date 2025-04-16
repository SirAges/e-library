import jwt, { JwtPayload } from "jsonwebtoken";

import {
  JWT_ACCESS_TOKEN_EXPIRES_IN,
  JWT_REFRESH_SECRET,
  JWT_REFRESH_TOKEN_EXPIRES_IN,
  JWT_SECRET,
  NODE_ENV,
} from "../config/env";
import { AppType } from "../lib/enums";
type TokenType = {
  userId: number;
  role: string;
  email: string;
};
// **Generate JWT Tokens**
export const generateTokens = (data: TokenType) => {
  const accessToken = jwt.sign({ ...data }, JWT_SECRET!, {
    expiresIn: `${parseInt(JWT_ACCESS_TOKEN_EXPIRES_IN!)}d`,
  });

  const refreshToken = jwt.sign({ ...data }, JWT_REFRESH_SECRET!, {
    expiresIn: `${parseInt(JWT_REFRESH_TOKEN_EXPIRES_IN!)}d`,
  });
  return { accessToken, refreshToken };
};

// **Store Refresh Token in HTTP-Only Cookie**
export const setAppCookie = (
  res: {
    cookie: (
      arg0: string,
      arg1: string,
      arg2: {
        httpOnly: boolean;
        secure: boolean;
        sameSite: string;
        maxAge: number;
      }
    ) => void;
  },
  token: string,
  name: string
) => {
  res.cookie(name, token, {
    httpOnly: false,
    secure: NODE_ENV === AppType.production,
    sameSite: "none",
    maxAge: 1000 * 60 * 5,
  });
};

export const verifyToken = (
  token: jwt.Algorithm | string,
  secret: jwt.Secret
): JwtPayload | string | null => {
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    return null;
  }
};
