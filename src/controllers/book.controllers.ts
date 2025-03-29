import { NextFunction, Request as ExpressRequest, Response } from "express";
import prisma from "../config/prismaClient";
import { redis } from "../config/redisClient";
import { REDIS_CACHE_EXPIRY as REDIS_CACHE_EXPIRY_SECONDS } from "../config/env";

const REDIS_CACHE_EXPIRY = parseInt(REDIS_CACHE_EXPIRY_SECONDS!);
interface CloudinaryFile {
  secure_url: string;
  format: string;
  bytes: number;
  public_id: string;
}

interface Request extends ExpressRequest {
  uploadedFiles?: Record<string, CloudinaryFile>;
}
export const createBook = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = req.body;
    const { coverUrl, ebookUrl, videoUrl } = req.uploadedFiles!;

    const createdbook = await prisma.$transaction(async (tx) => {
      return tx.books.create({
        data: { ...data, coverUrl, ebookUrl, videoUrl },
      });
    });
    const cacheKey = `book:${createdbook.id}`;

    await redis.setex(
      cacheKey,
      REDIS_CACHE_EXPIRY!,
      JSON.stringify(createdbook)
    );
    res.status(200).json({
      error: false,
      success: true,
      message: "book created successfully",
      data: createdbook,
    });
  } catch (error) {
    next(error);
  } finally {
    await redis.quit();
  }
};

export const getBooks = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  const cacheKey = "book:all";

  try {
    const cachedbook = await redis.get(cacheKey);
    if (cachedbook) {
      res.status(200).json({
        error: false,
        success: true,
        message: "book fetched successfully",
        data: JSON.parse(cachedbook),
      });
      return;
    }
    const book = await prisma.books.findMany();
    await redis.setex(cacheKey, REDIS_CACHE_EXPIRY!, JSON.stringify(book));

    res.status(200).json({
      error: false,
      success: true,
      message: "book fetched successfully",
      data: book,
    });
  } catch (error) {
    next(error);
  }
};

export const getBook = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { bookId } = req.params;
    const cacheKey = `book:${bookId}`;
    const cachedbook = await redis.get(cacheKey);
    if (cachedbook) {
      res.status(200).json({
        error: false,
        success: true,
        message: "book fetched successfully",
        data: JSON.parse(cachedbook),
      });
      return;
    }
    const book = await prisma.books.findUnique({
      where: { id: parseInt(bookId) },
    });

    if (!book) {
      res.status(404).json({
        error: true,
        success: false,
        message: "book not found",
        data: null,
      });
      return;
    }
    await redis.setex(cacheKey, REDIS_CACHE_EXPIRY!, JSON.stringify(book));

    res.status(200).json({
      error: false,
      success: true,
      message: "book fetched successfully",
      data: book,
    });
  } catch (error) {
    next(error);
  }
};

export const updateBook = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { bookId } = req.params;
    const cacheKey = `book:${bookId}`;
    const data = req.body;

    if (!bookId) {
      res.status(400).json({
        error: true,
        success: false,
        message: "Missing book id param",
        data: null,
      });
      return;
    }

    const updatedbook = await prisma.$transaction(async (tx) => {
      return tx.books.update({
        where: { id: parseInt(bookId) },
        data,
      });
    });

    await redis.setex(
      cacheKey,
      REDIS_CACHE_EXPIRY!,
      JSON.stringify(updatedbook)
    );
    res.status(200).json({
      error: false,
      success: true,
      message: "book updated successfully",
      data: updatedbook,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteBook = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
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
    await prisma.$transaction(async (tx) => {
      await tx.books.delete({ where: { id: parseInt(bookId) } });
    });
    await redis.del(`book:${bookId}`);
    res.status(200).json({
      error: false,
      success: true,
      message: "book deleted successfully",
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

export const bookStatistics = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const threeYearsAgo = new Date();
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);

    // Fetch all books created within the last 3 years
    const books = await prisma.books.findMany({
      where: { createdAt: { gte: threeYearsAgo } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    // Aggregate books by year and month
    const statsMap = new Map();

    books.forEach(({ createdAt }) => {
      const date = new Date(createdAt);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const key = `${year}-${month}`;

      statsMap.set(key, (statsMap.get(key) || 0) + 1);
    });

    // Convert map to array
    const formattedStats = Array.from(statsMap.entries()).map(
      ([key, count]) => {
        const [year, month] = key.split("-").map(Number);
        return { year, month, count };
      }
    );

    // Sort the results
    formattedStats.sort((a, b) =>
      a.year === b.year ? a.month - b.month : a.year - b.year
    );

    // Calculate trend
    const calculateTrend = (current: number, previous: number) => {
      if (!previous) return { growth: current > 0, percentage: 100 };
      const change = ((current - previous) / previous) * 100;
      return {
        growth: change > 0,
        percentage: parseFloat(change.toFixed(2)),
      };
    };

    const lastPeriod = formattedStats.at(-1) || { count: 0 };
    const prevPeriod = formattedStats.at(-2) || { count: 0 };
    const bookTrend = calculateTrend(lastPeriod.count, prevPeriod.count);

    // Send response
    res.status(200).json({
      error: false,
      success: true,
      message: "Book statistics fetched successfully",
      data: {
        totalBooks: books.length,
        stats: formattedStats,
        trend: bookTrend,
      },
    });
  } catch (error) {
    next(error);
  }
};
