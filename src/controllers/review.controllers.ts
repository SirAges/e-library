import { NextFunction, Request as ExpressRequest, Response } from "express";
import prisma from "../config/prismaClient";
import redis from "../config/redisClient";
import { REDIS_CACHE_EXPIRY_SECONDS } from "../config/env";
import { dataHasher, invalidateCache } from "../lib/utils";

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

        message: "You can not review this book without specifying rating",
      });
      return;
    }
    if (!comment) {
      res.status(400).json({
        error: true,

        message: "You can not review this book without commenting",
      });
      return;
    }
    if (!bookId) {
      res.status(400).json({
        error: true,

        message: "Missing book id param",
      });
      return;
    }
    const userAlreadyReviewed = await prisma.reviews.findFirst({
      where: { userId, bookId: parseInt(bookId) },
    });
    if (userAlreadyReviewed) {
      res.status(409).json({
        error: true,
        message: "You already reviewed this book",
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
    await invalidateCache("review");
    await redis.setex(
      cacheKey,
      REDIS_CACHE_EXPIRY!,
      JSON.stringify(createdReview)
    );
    res.status(200).json({
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
  const {
    sort = "desc",
    limit = "10",
    page = "1",
    sortBy = "createdAt",
  } = req.query;
  const currentPage = parseInt(page.toString(), 10);
  const take = parseInt(limit.toString(), 10);
  const skip = (currentPage - 1) * take;
  const sortedBy = sortBy?.toString();

  if (!bookId) {
    res.status(400).json({
      error: true,

      message: "Missing book id param",
    });
    return;
  }
  const hashedData = dataHasher(JSON.stringify(req.query));
  const cacheKey = `review:${bookId}:all:${hashedData}`;

  try {
    const cachedReview = await redis.get(cacheKey);
    if (cachedReview) {
      res.status(200).json({
        success: true,
        message: "Reviews fetched successfully",
        data: JSON.parse(cachedReview),
      });
      return;
    }
    const reviews = await prisma.reviews.findMany({
      where: { bookId: parseInt(bookId) },
      orderBy: { [sortedBy]: sort === "desc" ? "desc" : "asc" },
      take,
      skip,
      omit: {
        updatedAt: true,
      },
    });
    const totalReviews = await prisma.reviews.count({
      where: { bookId: parseInt(bookId) },
    });
    const totalPages = Math.ceil(totalReviews / take);
    const nextPage = totalPages - currentPage > 0 ? currentPage + 1 : null;
    const totalRatings = reviews.reduce((acc, cur) => acc + cur.rating, 0);
    const averageRating = parseInt((totalRatings / totalReviews).toFixed(1));
    await redis.setex(
      cacheKey,
      REDIS_CACHE_EXPIRY!,
      JSON.stringify({
        reviews,
        totalReviews,
        averageRating,
        totalPages,
        nextPage,
      })
    );

    res.status(200).json({
      success: true,
      message: "Reviews fetched successfully",
      data: { reviews, totalReviews, averageRating, totalPages, nextPage },
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

        message: "You can not review this book without specifying rating",
      });
      return;
    }
    if (!comment) {
      res.status(400).json({
        error: true,

        message: "You can not review this book without commenting",
      });
      return;
    }
    if (!reviewId) {
      res.status(400).json({
        error: true,

        message: "Missing review id param",
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
    await invalidateCache("review");

    await redis.setex(
      cacheKey,
      REDIS_CACHE_EXPIRY!,
      JSON.stringify(updatedReview)
    );
    res.status(200).json({
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

        message: "Missing review id param",
      });
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.reviews.delete({ where: { id: parseInt(reviewId) } });

      await redis.del(`review:${reviewId}`);
      await invalidateCache("review");

      res.status(200).json({
        success: true,
        message: "Review deleted successfully",
      });
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

    const rawStats = await prisma.reviews.findMany({
      where: { createdAt: { gte: threeYearsAgo } },
      select: {
        createdAt: true,
        rating: true,
      },
      orderBy: { createdAt: "asc" },
    });

    const monthStatsMap = new Map();

    rawStats.forEach((item) => {
      const date = new Date(item.createdAt);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const key = `${year}-${month}`;

      if (!monthStatsMap.has(key)) {
        monthStatsMap.set(key, {
          year,
          month,
          totalRating: 0,
          count: 0,
        });
      }

      const entry = monthStatsMap.get(key);
      entry.totalRating += item.rating;
      entry.count += 1;
    });

    const formattedStats = Array.from(monthStatsMap.values()).map((item) => ({
      year: item.year,
      month: item.month,
      averageRating: parseFloat((item.totalRating / item.count).toFixed(2)),
      count: item.count,
    }));

    const calculateTrend = (current: number, previous: number) => {
      if (!previous) return { growth: current > 0, percentage: 100 };
      const change = ((current - previous) / previous) * 100;
      return {
        growth: change > 0,
        percentage: parseFloat(change.toFixed(2)),
      };
    };

    const lastPeriod = formattedStats.at(-1) || { averageRating: 0 };
    const prevPeriod = formattedStats.at(-2) || { averageRating: 0 };

    const reviewTrend = calculateTrend(
      lastPeriod.averageRating,
      prevPeriod.averageRating
    );

    res.status(200).json({
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

export const searchBookReviews = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { bookId } = req.params;
  const {
    sort = "desc",
    limit = "10",
    page = "1",
    sortBy = "createdAt",
    rate,
    query,
  } = req.query;
  const currentPage = parseInt(page.toString(), 10);
  const take = parseInt(limit.toString(), 10);
  const skip = (currentPage - 1) * take;
  const sortedBy = sortBy?.toString();

  if (!bookId) {
    res.status(400).json({
      error: true,

      message: "Missing book id param",
    });
    return;
  }
  const hashedData = dataHasher(JSON.stringify(req.query));
  const cacheKey = `review:${bookId}:search:${hashedData}`;

  try {
    if (!query) {
      res.status(400).json({
        success: true,
        message: "serach query is required",
      });
      return;
    }
    const searchQuery = query.toString();
    const cachedReview = await redis.get(cacheKey);
    if (cachedReview) {
      res.status(200).json({
        success: true,
        message: "Reviews fetched successfully",
        data: JSON.parse(cachedReview),
      });
      return;
    }
    const reviews = await prisma.reviews.findMany({
      where: {
        bookId: parseInt(bookId),
        OR: [
          { comment: { contains: searchQuery, mode: "insensitive" } },
          { rating: { equals: parseInt(rate?.toString()!) } },
        ],
      },
      orderBy: { [sortedBy]: sort === "desc" ? "desc" : "asc" },
      take,
      skip,
      omit: {
        updatedAt: true,
      },
    });
    const totalReviews = await prisma.reviews.count();
    const totalPages = Math.ceil(totalReviews / take);
    const nextPage = totalPages - currentPage > 0 ? currentPage + 1 : null;

    await redis.setex(
      cacheKey,
      REDIS_CACHE_EXPIRY!,
      JSON.stringify({ reviews, totalReviews, totalPages, nextPage })
    );

    res.status(200).json({
      success: true,
      message: "Reviews fetched successfully",
      data: JSON.stringify({ reviews, totalReviews, totalPages, nextPage }),
    });
  } catch (error) {
    next(error);
  }
};
