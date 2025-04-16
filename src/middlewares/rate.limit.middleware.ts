import { Request, Response, NextFunction } from "express";
import redis from "../config/redisClient";
import logger from "../services/logger.service";
import { RateLimiterRedis } from "rate-limiter-flexible";
const { rateLimit } = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");

const limiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: "middleware",
  points: 10,
  duration: 1,
});
export const rateLimiter = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  limiter
    .consume(req.ip as string)
    .then(() => next())
    .catch(() => {
      logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
      res.status(429).json({ message: "Too many requests" });
    });
};

export const sensitiveEndpointsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: false,
  legacyHeaders: false,
  handler: (req: Request, res: Response, next: NextFunction) => {
    logger.warn(`Sensitive endpoint rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({ message: "Too many requests" });
  },
  store: new RedisStore({
    //@ts-ignore
    sendCommand: (...args: any[]) => redis.call(...args),
  }),
});
