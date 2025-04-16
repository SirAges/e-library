import express, { NextFunction, Request, Response } from "express";
import path from "path";
import errorMiddleware from "./middlewares/error.middleware";
import authRouter from "./routes/auth.routes";
import userRouter from "./routes/user.routes";
import { userAuthorization } from "./middlewares/auth.middleware";
import bookRouter from "./routes/book.routes";
import borrowRouter from "./routes/borrow.routes";
import reviewRouter from "./routes/review.routes";
import cookieParser from "cookie-parser";
import cors, { CorsOptions } from "cors";
import helmet from "helmet";
import {
  rateLimiter,
  sensitiveEndpointsLimiter,
} from "./middlewares/rate.limit.middleware";
import logger from "./services/logger.service";
import corsOption from "./config/cors";
import redis from "./config/redisClient";
import setupSwagger from "./config/swagger";
import { PORT } from "./config/env";
import app from "./app";

app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(helmet());
app.use(cors(corsOption as CorsOptions));

app.use(rateLimiter);
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info(
    `Method: ${req.method}, Url: request to ${req.url}, Body: ${JSON.stringify(
      req.body
    )}`
  );
  next();
});

const publicPath = path.join(__dirname, "../public");
app.use(express.static(publicPath));

app.get("/api/v1", (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,

    message: "Welcome to la book api",
  });
});

app.use("/api/v1/auth", sensitiveEndpointsLimiter, authRouter);
app.use("/api/v1/users", userAuthorization, userRouter);
app.use("/api/v1/books", userAuthorization, bookRouter);
app.use("/api/v1/borrows", userAuthorization, borrowRouter);
app.use("/api/v1/reviews", userAuthorization, reviewRouter);
setupSwagger(app);
app.use(errorMiddleware);

app.use((_req: Request, res: Response) => {
  res.status(404).sendFile(path.join(publicPath, "./not-found.html"));
});

export const server = app.listen(PORT, (err) => {
  console.log(`Server running on port 5500`);
});

process.on("SIGINT", async () => {
  console.log("closing connection...");
  await redis.quit();
  server.close(() => {
    console.log("Express server closed");
    process.exit(0);
  });
});
