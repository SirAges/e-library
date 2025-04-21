import jwt, { JwtPayload } from "jsonwebtoken";

import {
  JWT_ACCESS_TOKEN_EXPIRES_IN,
  JWT_REFRESH_SECRET,
  JWT_REFRESH_TOKEN_EXPIRES_IN,
  JWT_SECRET,
} from "../config/env";
type TokenType = {
  userId: number;
  role: string;
  email: string;
};
export const generateTokens = (data: TokenType) => {
  const accessToken = jwt.sign({ ...data }, JWT_SECRET!, {
    expiresIn: `${parseInt(JWT_ACCESS_TOKEN_EXPIRES_IN!)}m`,
  });

  const refreshToken = jwt.sign({ ...data }, JWT_REFRESH_SECRET!, {
    expiresIn: `${parseInt(JWT_REFRESH_TOKEN_EXPIRES_IN!)}d`,
  });
  return { accessToken, refreshToken };
};

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
    httpOnly: true,
    secure: true,
    sameSite: "None",
    maxAge: 1000 * 60 * 60 * 24,
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
