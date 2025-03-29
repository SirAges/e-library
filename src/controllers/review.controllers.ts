import { NextFunction, Request as ExpressRequest, Response } from "express";
import prisma from "../config/prismaClient";
import { redis } from "../config/redisClient";
import { REDIS_CACHE_EXPIRY as REDIS_CACHE_EXPIRY_SECONDS } from "../config/env";

interface Request extends ExpressRequest {
  user?: {
    userId: number;
    email: string;
    role: string;
  };
}

const REDIS_CACHE_EXPIRY = parseInt(REDIS_CACHE_EXPIRY_SECONDS!);

export const reviewBook = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { rating, comment } = req.body;
    const { bookId } = req.params;
    const { userId } = req.user!;

    if (!rating) {
      res.status(400).json({
        error: true,
        success: false,
        message: "You can not review this book without specifying rating",
        data: null,
      });
      return;
    }
    if (!comment) {
      res.status(400).json({
        error: true,
        success: false,
        message: "You can not review this book without commenting",
        data: null,
      });
      return;
    }
    if (!bookId) {
      res.status(400).json({
        error: true,
        success: false,
        message: "Missing book id param",
        data: null,
      });
      return;
    }
    const userAlreadyReviewed = await prisma.reviews.findFirst({
      where: { userId, bookId: parseInt(bookId) },
    });
    if (userAlreadyReviewed) {
      res.status(404).json({
        error: true,
        success: false,
        message: "You already reviewed this book",
        data: null,
      });
      return;
    }
    const createdReview = await prisma.$transaction(async (tx) => {
      const createdReview = tx.reviews.create({
        data: { rating, comment, userId, bookId: parseInt(bookId) },
        omit: {
          updatedAt: true,
        },
      });
      return createdReview;
    });
    const cacheKey = `review:${createdReview.id}`;

    await redis.setex(
      cacheKey,
      REDIS_CACHE_EXPIRY!,
      JSON.stringify(createdReview)
    );
    res.status(200).json({
      error: false,
      success: true,
      message: "Review created successfully",
      data: createdReview,
    });
  } catch (error) {
    next(error);
  }
};

export const getBookReviews = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { bookId } = req.params;

  if (!bookId) {
    res.status(400).json({
      error: true,
      success: false,
      message: "Missing book id param",
      data: null,
    });
    return;
  }
  const cacheKey = `review:${bookId}:all`;

  try {
    const cachedReview = await redis.get(cacheKey);
    if (cachedReview) {
      res.status(200).json({
        error: false,
        success: true,
        message: "Reviews fetched successfully",
        data: JSON.parse(cachedReview),
      });
      return;
    }
    const reviews = await prisma.reviews.findMany({
      where: { bookId: parseInt(bookId) },
      omit: {
        updatedAt: true,
      },
    });
    await redis.setex(cacheKey, REDIS_CACHE_EXPIRY!, JSON.stringify(reviews));

    res.status(200).json({
      error: false,
      success: true,
      message: "Reviews fetched successfully",
      data: reviews,
    });
  } catch (error) {
    next(error);
  }
};

export const updateReview = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { reviewId } = req.params;
    const { userId } = req.user!;
    const { comment, rating } = req.body;

    if (!rating) {
      res.status(400).json({
        error: true,
        success: false,
        message: "You can not review this book without specifying rating",
        data: null,
      });
      return;
    }
    if (!comment) {
      res.status(400).json({
        error: true,
        success: false,
        message: "You can not review this book without commenting",
        data: null,
      });
      return;
    }
    if (!reviewId) {
      res.status(400).json({
        error: true,
        success: false,
        message: "Missing review id param",
        data: null,
      });
      return;
    }
    const cacheKey = `review:${reviewId}`;

    const updatedReview = await prisma.$transaction(async (tx) => {
      return tx.reviews.update({
        where: { id: parseInt(reviewId), userId },
        data: { rating, comment },
        omit: {
          updatedAt: true,
        },
      });
    });

    await redis.setex(
      cacheKey,
      REDIS_CACHE_EXPIRY!,
      JSON.stringify(updatedReview)
    );
    res.status(200).json({
      error: false,
      success: true,
      message: "Review updated successfully",
      data: updatedReview,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteReview = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { reviewId } = req.params;

    if (!reviewId) {
      res.status(400).json({
        error: true,
        success: false,
        message: "Missing review id param",
        data: null,
      });
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.reviews.delete({ where: { id: parseInt(reviewId) } });
    });

    await redis.del(`review:${reviewId}`);

    res.status(200).json({
      error: false,
      success: true,
      message: "Review deleted successfully",
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

export const reviewStatistics = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const threeYearsAgo = new Date();
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);

    const totalStats = await prisma.reviews.aggregate({
      where: { createdAt: { gte: threeYearsAgo } },
      _count: { id: true },
    });

    const stats = await prisma.reviews.groupBy({
      by: ["bookId", "createdAt"],
      where: { createdAt: { gte: threeYearsAgo } },
      _count: { id: true },
      _avg: { rating: true },
      orderBy: { createdAt: "asc" },
    });

    const bookIds = [...new Set(stats.map((s) => s.bookId))];
    const books = await prisma.books.findMany({
      where: { id: { in: bookIds } },
      select: { id: true, title: true },
    });

    const bookMap = new Map(books.map((book) => [book.id, book.title]));

    const bookStatsMap = new Map();

    stats.forEach((item) => {
      const date = new Date(item.createdAt);
      const title = bookMap.get(item.bookId) || "Unknown Book";
      const key = `${item.bookId}-${date.getFullYear()}-${date.getMonth() + 1}`;

      if (!bookStatsMap.has(key)) {
        bookStatsMap.set(key, {
          title,
          year: date.getFullYear(),
          month: date.getMonth() + 1,
          averageRating: 0,
          count: 0,
        });
      }

      const bookData = bookStatsMap.get(key);
      bookData.averageRating = item._avg.rating
        ? parseFloat(item._avg.rating.toFixed(2))
        : 0;
      bookData.count += item._count.id;
    });

    const formattedStats = Array.from(bookStatsMap.values());

    function calculateTrend(current: number, previous: number) {
      if (!previous) return { growth: current > 0, percentage: 100 };
      const change = ((current - previous) / previous) * 100;
      return {
        growth: change > 0,
        percentage: parseFloat(change.toFixed(2)),
      };
    }

    const lastPeriod = formattedStats.at(-1) || { count: 0 };
    const prevPeriod = formattedStats.at(-2) || { count: 0 };

    const reviewTrend = calculateTrend(lastPeriod.count, prevPeriod.count);

    res.status(200).json({
      error: false,
      success: true,
      message: "Review statistics fetched successfully",
      data: {
        totalReviews: totalStats._count.id || 0,
        stats: formattedStats,
        trend: reviewTrend,
      },
    });
  } catch (error) {
    next(error);
  }
};
