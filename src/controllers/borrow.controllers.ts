import { NextFunction, Request as ExpressRequest, Response } from "express";
import prisma from "../config/prismaClient";
import { redis } from "../config/redisClient";
import { REDIS_CACHE_EXPIRY as REDIS_CACHE_EXPIRY_SECONDS } from "../config/env";
import { scheduleBorrowReminder } from "../services/reminder.service";

interface Request extends ExpressRequest {
  user?: {
    userId: number;
    email: string;
    role: string;
  };
}

const REDIS_CACHE_EXPIRY = parseInt(REDIS_CACHE_EXPIRY_SECONDS!);

export const borrowBook = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { bookId } = req.body;
    const { userId } = req.user!;

    if (!bookId) {
      res.status(400).json({
        error: true,
        success: false,
        message: "Missing book id",
        data: null,
      });
      return;
    }

    const borrowDate = new Date().toISOString();

    const borrowedBook = await prisma.borrows.findFirst({
      where: {
        userId,
        bookId,
        status: { not: { equals: "RETURNED" } },
      },
    });
    if (borrowedBook) {
      res.status(200).json({
        error: false,
        success: true,
        message:
          "You have previously borrowed this book and you have not returned it",
        data: borrowedBook,
      });
      return;
    }
    const createdborrow = await prisma.$transaction(async (tx) => {
      const newborrow = await tx.borrows.create({
        data: {
          borrowDate,
          userId,
          bookId,
        },
      });
      return newborrow;
    });
    const cacheKey = `borrow:${createdborrow.id}`;

    await redis.setex(
      cacheKey,
      REDIS_CACHE_EXPIRY!,
      JSON.stringify(createdborrow)
    );
    res.status(200).json({
      error: false,
      success: true,
      message: "You have successfully requested to borrow this book",
      data: createdborrow,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllBorrowedBooks = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  const cacheKey = "borrow:all";

  try {
    const cachedborrow = await redis.get(cacheKey);
    if (cachedborrow) {
      res.status(200).json({
        error: false,
        success: true,
        message: "borrows fetched successfully",
        data: JSON.parse(cachedborrow),
      });
      return;
    }
    const borrows = await prisma.borrows.findMany();
    await redis.setex(cacheKey, REDIS_CACHE_EXPIRY!, JSON.stringify(borrows));

    res.status(200).json({
      error: false,
      success: true,
      message: "borrows fetched successfully",
      data: borrows,
    });
  } catch (error) {
    next(error);
  }
};

export const getBorrowedBook = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { borrowId } = req.params;
    if (!borrowId) {
      res.status(400).json({
        error: true,
        success: false,
        message: "Missing borrowed book id param",
        data: null,
      });
      return;
    }
    const cacheKey = `borrow:${borrowId}`;
    const cachedborrow = await redis.get(cacheKey);
    if (cachedborrow) {
      res.status(200).json({
        error: false,
        success: true,
        message: "borrow fetched successfully from cache",
        data: JSON.parse(cachedborrow),
      });
      return;
    }
    const borrow = await prisma.borrows.findUnique({
      where: { id: parseInt(borrowId) },
    });

    if (!borrow) {
      res.status(404).json({
        error: true,
        success: false,
        message: "borrow not found",
        data: null,
      });
      return;
    }
    await redis.setex(cacheKey, REDIS_CACHE_EXPIRY!, JSON.stringify(borrow));

    res.status(200).json({
      error: false,
      success: true,
      message: "borrow fetched successfully",
      data: borrow,
    });
  } catch (error) {
    next(error);
  }
};

export const extendReturnDate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { borrowId } = req.params;
    const { userId } = req.user!;
    if (!borrowId) {
      res.status(400).json({
        error: true,
        success: false,
        message: "Missing borrowed book id param",
        data: null,
      });
      return;
    }
    const foundBorrow = await prisma.borrows.findFirst({
      where: { id: parseInt(borrowId), userId },
    });

    if (!foundBorrow) {
      res.status(404).json({
        error: true,
        success: false,
        message: "borrowed book not found",
        data: null,
      });
      return;
    }
    if (foundBorrow.status !== "APPROVED") {
      res.status(400).json({
        error: true,
        success: false,
        message: "This book has not been approved. wait for approval",
        data: null,
      });
      return;
    }

    const startDate = new Date(foundBorrow.borrowDate);
    const endDate = new Date(foundBorrow.returnDate);
    const differenceInMilliSeconds: number =
      endDate.getTime() - startDate.getTime();

    const differenceInDays = differenceInMilliSeconds / (1000 * 60 * 60 * 24);
    if (differenceInDays > 2) {
      res.status(400).json({
        error: true,
        success: false,
        message:
          "You can only request increase of return time 2 days to return day",
        data: null,
      });
      return;
    }
    if (differenceInDays < 1) {
      res.status(400).json({
        error: true,
        success: false,
        message: "Not returning this book on time may incur a fee",
        data: null,
      });
      return;
    }
    const extraDays = differenceInDays / 2;

    const dateNow = new Date();
    const next24Hrs = new Date(dateNow.setHours(dateNow.getHours() + 24))
      .toISOString()
      .replace(/T/, " ")
      .replace(/\. \d+z$/, "");

    if (extraDays < 1) {
      res.status(400).json({
        error: true,
        success: false,
        message: `Your time limit to hold this book is exhausted. You must return this book before ${next24Hrs}`,
        data: null,
      });
      return;
    }
    const newReturnDate = new Date(
      endDate.setDate(endDate.getDate() + Math.round(extraDays))
    ).toISOString();

    const cacheKey = `borrow:${borrowId}`;

    const updatedborrow = await prisma.$transaction(async (tx) => {
      const newborrow = await tx.borrows.update({
        where: { id: parseInt(borrowId), userId },
        data: { returnDate: newReturnDate, status: "PENDING" },
      });

      return newborrow;
    });

    await redis.setex(
      cacheKey,
      REDIS_CACHE_EXPIRY!,
      JSON.stringify(updatedborrow)
    );
    await scheduleBorrowReminder(updatedborrow.id);
    res.status(200).json({
      error: false,
      success: true,
      message: "borrow updated successfully",
      data: updatedborrow,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteBorrowedBook = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { borrowId } = req.params;
    if (!borrowId) {
      res.status(400).json({
        error: true,
        success: false,
        message: "Missing borrowed book id param",
        data: null,
      });
      return;
    }
    await prisma.$transaction(async (tx) => {
      await tx.borrows.delete({
        where: { id: parseInt(borrowId) },
      });
    });
    await redis.del(`borrow:${borrowId}`);
    res.status(200).json({
      error: false,
      success: true,
      message: "borrowed book deleted successfully",
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllBorrowedBookStatistics = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const threeYearsAgo = new Date();
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);

    // Fetch borrow records including status
    const borrows = await prisma.borrows.findMany({
      where: { createdAt: { gte: threeYearsAgo } },
      select: { createdAt: true, status: true },
      orderBy: { createdAt: "asc" },
    });

    // Aggregate borrows by year, month, and status
    const statsMap = new Map();

    borrows.forEach(({ createdAt, status }) => {
      const date = new Date(createdAt);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const key = `${year}-${month}`;

      if (!statsMap.has(key)) {
        statsMap.set(key, {
          year,
          month,
          count: 0,
          APPROVED: 0,
          PENDING: 0,
          REJECTED: 0,
          CANCELLED: 0,
          RETURNED: 0,
        });
      }

      const stat = statsMap.get(key);
      stat.count += 1;
      stat[status] = (stat[status] || 0) + 1; // Increment status count
    });

    // Convert map to sorted array
    const formattedStats = Array.from(statsMap.values()).sort((a, b) =>
      a.year === b.year ? a.month - b.month : a.year - b.year
    );

    // Function to calculate trend
    const calculateTrend = (current: number, previous: number) => {
      if (!previous) return { growth: current > 0, percentage: 100 };
      const change = ((current - previous) / previous) * 100;
      return { growth: change > 0, percentage: parseFloat(change.toFixed(2)) };
    };

    // Calculate trends
    const lastPeriod = formattedStats.at(-1) || { count: 0 };
    const prevPeriod = formattedStats.at(-2) || { count: 0 };
    const borrowTrend = calculateTrend(lastPeriod.count, prevPeriod.count);

    // Send response
    res.status(200).json({
      error: false,
      success: true,
      message: "Borrow statistics fetched successfully",
      data: {
        totalBorrows: borrows.length,
        stats: formattedStats,
        trend: borrowTrend,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getUserBorrowedBooks = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { userId } = req.user!;

  const cacheKey = `borrow:user:${userId}`;

  try {
    const cachedborrow = await redis.get(cacheKey);
    if (cachedborrow) {
      res.status(200).json({
        error: false,
        success: true,
        message: "User borrow fetched successfully",
        data: JSON.parse(cachedborrow),
      });
      return;
    }

    const userborrows = await prisma.borrows.findMany({
      where: { userId },
    });
    await redis.setex(
      cacheKey,
      REDIS_CACHE_EXPIRY!,
      JSON.stringify(userborrows)
    );
    res.status(200).json({
      error: false,
      success: true,
      message: "User borrow fetched successfully",
      data: userborrows,
    });
  } catch (error) {
    next(error);
  }
};

export const cancelRequestForBorrowedBook = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { borrowId } = req.params;
  const { userId } = req.user!;
  if (!borrowId) {
    res.status(400).json({
      error: true,
      success: false,
      message: "Missing borrowed book id param",
      data: null,
    });
    return;
  }
  const cacheKey = `borrow:${borrowId}`;

  try {
    const updatedborrow = await prisma.$transaction(async (tx) => {
      const newborrow = await tx.borrows.update({
        where: {
          id: parseInt(borrowId),
          userId,
          NOT: { status: { in: ["COLLECTED", "REJECTED", "RETURNED"] } },
        },
        data: { status: "CANCELLED" },
      });
      return newborrow;
    });
    await redis.setex(
      cacheKey,
      REDIS_CACHE_EXPIRY!,
      JSON.stringify(updatedborrow)
    );
    res.status(200).json({
      error: false,
      success: true,
      message: `Borrowed book with book id ${borrowId} has been CANCELLED`,
      data: updatedborrow,
    });
  } catch (error) {
    next(error);
  }
};

export const updateBorrowedBookStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { borrowId } = req.params;
  const { userId } = req.user!;
  const { status } = req.body;
  if (!borrowId) {
    res.status(400).json({
      error: true,
      success: false,
      message: "Missing borrowed book id param",
      data: null,
    });
    return;
  }

  if (!status) {
    res.status(400).json({
      error: true,
      success: false,
      message: "Missing status for book status update",
      data: null,
    });
    return;
  }
  const returnDate = new Date(
    new Date().setDate(new Date().getDate() + 7)
  ).toISOString();
  const cacheKey = `borrow:${borrowId}`;
  try {
    const updatedborrow = await prisma.$transaction(async (tx) => {
      const newborrow = await tx.borrows.update({
        where: {
          id: parseInt(borrowId),
          NOT: {
            status: {
              in: ["CANCELLED", status],
            },
          },
        },
        data: {
          status,
          returnDate: status === "APPROVED" ? returnDate : undefined,
          librarianId: userId,
        },
      });
      return newborrow;
    });
    await redis.setex(
      cacheKey,
      REDIS_CACHE_EXPIRY!,
      JSON.stringify(updatedborrow)
    );
    if (updatedborrow.status==="APPROVED"){
      await scheduleBorrowReminder(updatedborrow.id);
    }
      res.status(200).json({
        error: false,
        success: true,
        message: `Borrowed book with book id ${borrowId} has been ${status}`,
        data: updatedborrow,
      });
  } catch (error) {
    next(error);
  }
};
