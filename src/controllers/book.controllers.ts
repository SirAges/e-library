import { NextFunction, Request as ExpressRequest, Response } from "express";
import prisma from "../config/prismaClient";
import redis from "../config/redisClient";
import { REDIS_CACHE_EXPIRY_SECONDS } from "../config/env";
import {
  dataHasher,
  deleteMediaFromCloudinary,
  invalidateCache,
} from "../lib/utils";
import { JsonObject } from "@prisma/client/runtime/library";
import fs from "fs";

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
const parseValue = (value: string) => {
  if (!isNaN(parseInt(value)) && value.trim() !== "") return Number(value);
  if (value === "true") return true;
  if (value === "false") return false;
};
export const createBook = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const body = req.body;
    const pages = parseInt(body.pages);
    const copies = parseInt(body.copies);
    const year = parseInt(body.year);
    const data = { ...body, pages, copies, year };
    const { coverUrl, ebookUrl, videoUrl } = req.uploadedFiles!;
    const createdbook = await prisma.$transaction(async (tx) => {
      return tx.books.create({
        data: { ...data, coverUrl, ebookUrl, videoUrl },
      });
    });
    const cacheKey = `book:${createdbook.id}`;
    await invalidateCache("book");
    await redis.setex(
      cacheKey,
      REDIS_CACHE_EXPIRY!,
      JSON.stringify(createdbook)
    );
    res.status(200).json({
      success: true,
      message: "book created successfully",
      data: createdbook,
    });
  } catch (error) {
    console.log("error", error);
    next(error);
  }
};

export const getBooks = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const {
    sort = "desc",
    limit = "10",
    genre,
    page = "1",
    sortBy = "createdAt",
  } = req.query;
  const hashedData = dataHasher(JSON.stringify(req.query));
  const cacheKey = `book:all:${hashedData}`;
  const currentPage = parseInt(page.toString(), 10);
  const take = parseInt(limit.toString(), 10);
  const skip = (currentPage - 1) * take;
  const sortedBy = sortBy?.toString();
  const parsedGenre =
    genre === "null"
      ? null
      : genre === "undefined"
      ? undefined
      : genre?.toString();

  try {
    const cachedbook = await redis.get(cacheKey);
    if (cachedbook) {
      res.status(200).json({
        success: true,
        message: "book fetched successfully",
        data: JSON.parse(cachedbook),
      });
      return;
    }
    // console.log('starting..')
    // const allGenres = await prisma.books.findMany();
    // const genres = [
    //   ...new Set(allGenres.map((book) => book.genre)),
    // ] as string[];
    // fs.writeFileSync("genre.json", JSON.stringify(genres, null, 2), "utf-8");
    // console.log("ending..");

    const book = await prisma.books.findMany({
      where: {
        genre:
          parsedGenre && parsedGenre !== "undefined"
            ? { equals: parsedGenre, mode: "insensitive" }
            : undefined,
      },
      orderBy: { [sortedBy]: sort === "desc" ? "desc" : "asc" },
      take,
      skip,
    });
    const totalBooks = await prisma.books.count();
    const totalPages = Math.ceil(totalBooks / take);
    const nextPage = totalPages - currentPage > 0 ? currentPage + 1 : null;

    await redis.setex(
      cacheKey,
      REDIS_CACHE_EXPIRY!,
      JSON.stringify({ book, totalBooks, totalPages, nextPage })
    );

    res.status(200).json({
      success: true,
      message: "book fetched successfully",
      data: { book, totalBooks, totalPages, nextPage },
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
        success: true,
        message: "book fetched successfully",
        data: JSON.parse(cachedbook),
      });
      return;
    }
    const singleBook = await prisma.books.findUnique({
      where: { id: parseInt(bookId) },
    });
    const avgRating = await prisma.reviews.aggregate({
      where: { bookId: parseInt(bookId) },
      _avg: {
        rating: true,
      },
    });
    const book = { ...singleBook, avgRating: avgRating._avg.rating || 0 };
    if (!book) {
      res.status(404).json({
        error: true,

        message: "book not found",
      });
      return;
    }
    await redis.setex(cacheKey, REDIS_CACHE_EXPIRY!, JSON.stringify(book));

    res.status(200).json({
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
    const data = req.body;
    const cacheKey = `book:${bookId}`;

    if (!bookId) {
      res.status(400).json({
        error: true,

        message: "Missing book id param",
      });
      return;
    }

    const updatedbook = await prisma.$transaction(async (tx) => {
      return tx.books.update({
        where: { id: parseInt(bookId) },
        data,
      });
    });
    await invalidateCache("book");
    await redis.setex(
      cacheKey,
      REDIS_CACHE_EXPIRY!,
      JSON.stringify(updatedbook)
    );
    res.status(200).json({
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

        message: "Missing book id param",
      });
      return;
    }
    await prisma.$transaction(async (tx) => {
      const deletedBook = await tx.books.delete({
        where: { id: parseInt(bookId) },
        select: { videoUrl: true, coverUrl: true, ebookUrl: true },
      });

      const videoUrl = deletedBook.videoUrl as JsonObject;
      const coverUrl = deletedBook.videoUrl as JsonObject;
      const ebookUrl = deletedBook.videoUrl as JsonObject;

      if (videoUrl) {
        await deleteMediaFromCloudinary(videoUrl.public_id as string);
      }
      if (coverUrl) {
        await deleteMediaFromCloudinary(coverUrl.public_id as string);
      }
      if (ebookUrl) {
        await deleteMediaFromCloudinary(ebookUrl.public_id as string);
      }
      await redis.del(`book:${bookId}`);
      await invalidateCache("book");
      res.status(200).json({
        success: true,
        message: "book deleted successfully",
      });
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

    const books = await prisma.books.findMany({
      where: { createdAt: { gte: threeYearsAgo } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    const statsMap = new Map();

    books.forEach(({ createdAt }) => {
      const date = new Date(createdAt);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const key = `${year}-${month}`;

      statsMap.set(key, (statsMap.get(key) || 0) + 1);
    });

    const formattedStats = Array.from(statsMap.entries()).map(
      ([key, count]) => {
        const [year, month] = key.split("-").map(Number);
        return { year, month, count };
      }
    );

    formattedStats.sort((a, b) =>
      a.year === b.year ? a.month - b.month : a.year - b.year
    );

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

    res.status(200).json({
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

export const searchBooks = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const {
    sort = "desc",
    limit = "10",
    page = "1",
    sortBy = "createdAt",
    query,
    year,
  } = req.query;
  const currentPage = parseInt(page.toString(), 10);
  const take = parseInt(limit.toString(), 10);
  const skip = (currentPage - 1) * take;
  const sortedBy = sortBy?.toString();

  const hashedData = dataHasher(JSON.stringify(req.query));
  const cacheKey = `book:search:${hashedData}`;
  try {
    if (!query) {
      res.status(400).json({
        success: true,
        message: "serach query is required",
      });
      return;
    }
    const searchQuery = query.toString();
    const cachedbook = await redis.get(cacheKey);
    if (cachedbook) {
      res.status(200).json({
        success: true,
        message: "book fetched successfully",
        data: JSON.parse(cachedbook),
      });
      return;
    }

    const books = await prisma.books.findMany({
      where: {
        OR: [
          { author: { contains: searchQuery, mode: "insensitive" } },
          { genre: { contains: searchQuery, mode: "insensitive" } },
          { description: { contains: searchQuery, mode: "insensitive" } },
          { edition: { contains: searchQuery, mode: "insensitive" } },
          { isbn: { contains: searchQuery, mode: "insensitive" } },
          { language: { contains: searchQuery, mode: "insensitive" } },
          { publisher: { contains: searchQuery, mode: "insensitive" } },
          { summary: { contains: searchQuery, mode: "insensitive" } },
          { title: { contains: searchQuery, mode: "insensitive" } },
          { callNumber: { contains: searchQuery, mode: "insensitive" } },
          { year: year ? { equals: parseInt(year.toString()) } : undefined },
        ],
      },
      orderBy: { [sortedBy]: sort === "desc" ? "desc" : "asc" },
      take,
      skip,
    });
    const totalBooks = await prisma.books.count({
      where: {
        OR: [
          { author: { contains: searchQuery, mode: "insensitive" } },
          { genre: { contains: searchQuery, mode: "insensitive" } },
          { description: { contains: searchQuery, mode: "insensitive" } },
          { edition: { contains: searchQuery, mode: "insensitive" } },
          { isbn: { contains: searchQuery, mode: "insensitive" } },
          { language: { contains: searchQuery, mode: "insensitive" } },
          { publisher: { contains: searchQuery, mode: "insensitive" } },
          { summary: { contains: searchQuery, mode: "insensitive" } },
          { title: { contains: searchQuery, mode: "insensitive" } },
          { callNumber: { contains: searchQuery, mode: "insensitive" } },
          { year: year ? { equals: parseInt(year.toString()) } : undefined },
        ],
      },
    });

    const totalPages = Math.ceil(totalBooks / take);
    const nextPage = totalPages - currentPage > 0 ? currentPage + 1 : null;

    await redis.setex(
      cacheKey,
      REDIS_CACHE_EXPIRY!,
      JSON.stringify({ books, totalBooks, totalPages, nextPage })
    );

    res.status(200).json({
      success: true,
      message: "book fetched successfully",
      data: { books, totalBooks, totalPages, nextPage },
    });
  } catch (error) {
    next(error);
  }
};
