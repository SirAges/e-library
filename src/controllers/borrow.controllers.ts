import { NextFunction, Request as ExpressRequest, Response } from "express";
import prisma from "../config/prismaClient";
import redis from "../config/redisClient";
import { REDIS_CACHE_EXPIRY_SECONDS } from "../config/env";
import { scheduleBorrowReminder } from "../services/reminder.service";
import { dataHasher, invalidateCache } from "../lib/utils";
import { BookStatus, BorrowStatus } from "../lib/enums";

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

        message: "Missing book id",
      });
      return;
    }

    const borrowDate = new Date().toISOString();
    const book = await prisma.books.findFirst({
      where: {
        id: bookId,
        status: {
          in: [BookStatus.CHECKED_OUT, BookStatus.LOST, BookStatus.RESERVED],
        },
        borrowCount: { lt: 1 },
      },
    });
    if (book) {
      res.status(404).json({
        error: true,
        message: "This book is not available to borrow",
      });
      return;
    }
    const borrowedBookNotApproved = await prisma.borrows.findFirst({
      where: {
        userId,
        bookId,
        status: { not: { equals: BorrowStatus.APPROVED } },
      },
    });
    if (borrowedBookNotApproved) {
      res.status(409).json({
        error: true,
        message:
          "You have previously borrowed this book and it is still pending approval",
      });
      return;
    }
    const borrowedBookNotReturned = await prisma.borrows.findFirst({
      where: {
        userId,
        bookId,
        status: { not: { equals: BorrowStatus.RETURNED } },
      },
    });
    if (borrowedBookNotReturned) {
      res.status(409).json({
        error: true,
        message:
          "You have previously borrowed this book and you have not returned it or it is still pending approval",
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
    await invalidateCache("borrow");
    await redis.setex(
      cacheKey,
      REDIS_CACHE_EXPIRY!,
      JSON.stringify(createdborrow)
    );
    res.status(200).json({
      success: true,
      message: "You have successfully requested to borrow this book",
      data: createdborrow,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllBorrowedBooks = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const {
    sort = "desc",
    limit = "10",
    page = "1",
    sortBy = "createdAt",
    userId,
  } = req.query;
  const hashedData = dataHasher(JSON.stringify(req.query));
  const cacheKey = `borrow:all:${hashedData}`;
  const currentPage = parseInt(page.toString(), 10) || 1;
  const take = parseInt(limit.toString(), 10);
  const skip = (currentPage - 1) * take;
  const sortedBy = sortBy?.toString();

  try {
    const cachedborrow = await redis.get(cacheKey);
    if (cachedborrow) {
      res.status(200).json({
        success: true,
        message: "borrows fetched successfully cache",
        data: JSON.parse(cachedborrow),
      });
      return;
    }
    const borrows = await prisma.borrows.findMany({
      where: { userId: userId ? parseInt(userId.toString()) : undefined },
      orderBy: { [sortedBy]: sort === "desc" ? "desc" : "asc" },
      take,
      skip,
      include: {
        book: {
          select: {
            coverUrl: true,
            title: true,
          },
        },
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    const totalBorrowedBook = await prisma.borrows.count({
      where: { userId: userId ? parseInt(userId.toString()) : undefined },
    });
    const totalPages = Math.ceil(totalBorrowedBook / take) || 1;
    const nextPage = totalPages - currentPage > 0 ? currentPage + 1 : null;
    await redis.setex(
      cacheKey,
      REDIS_CACHE_EXPIRY!,
      JSON.stringify({ borrows, totalBorrowedBook, totalPages, nextPage })
    );

    res.status(200).json({
      success: true,
      message: "borrows fetched successfully",
      data: { borrows, totalBorrowedBook, totalPages, nextPage, currentPage },
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

        message: "Missing borrowed book id param",
      });
      return;
    }
    const cacheKey = `borrow:${borrowId}`;
    const cachedborrow = await redis.get(cacheKey);
    if (cachedborrow) {
      res.status(200).json({
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

        message: "borrow not found",
      });
      return;
    }
    await redis.setex(cacheKey, REDIS_CACHE_EXPIRY!, JSON.stringify(borrow));

    res.status(200).json({
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

        message: "Missing borrowed book id param",
      });
      return;
    }
    const foundBorrow = await prisma.borrows.findFirst({
      where: { id: parseInt(borrowId), userId },
    });

    if (!foundBorrow) {
      res.status(404).json({
        error: true,

        message: "borrowed book not found",
      });
      return;
    }
    if (foundBorrow.status !== BorrowStatus.APPROVED) {
      res.status(400).json({
        error: true,

        message: "This book has not been approved. wait for approval",
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

        message:
          "You can only request increase of return time 2 days to return day",
      });
      return;
    }
    if (differenceInDays < 1) {
      res.status(400).json({
        error: true,

        message: "Not returning this book on time may incur a fee",
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

        message: `Your time limit to hold this book is exhausted. You must return this book before ${next24Hrs}`,
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
        data: { returnDate: newReturnDate, status: BorrowStatus.PENDING },
      });

      return newborrow;
    });
    await invalidateCache("borrow");

    await redis.setex(
      cacheKey,
      REDIS_CACHE_EXPIRY!,
      JSON.stringify(updatedborrow)
    );
    await scheduleBorrowReminder(updatedborrow.id);
    res.status(200).json({
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

        message: "Missing borrowed book id param",
      });
      return;
    }
    await prisma.$transaction(async (tx) => {
      await tx.borrows.delete({
        where: { id: parseInt(borrowId) },
      });
    });
    await redis.del(`borrow:${borrowId}`);
    await invalidateCache("borrow");

    res.status(200).json({
      success: true,
      message: "borrowed book deleted successfully",
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

    const borrows = await prisma.borrows.findMany({
      where: { createdAt: { gte: threeYearsAgo } },
      select: { createdAt: true, status: true },
      orderBy: { createdAt: "asc" },
    });

    const statsMap = new Map();

    type BorrowStatus =
      | "APPROVED"
      | "PENDING"
      | "REJECTED"
      | "CANCELLED"
      | "RETURNED"
      | "COLLECTED";

    const totalStatusCounts: Record<BorrowStatus, number> = {
      APPROVED: 0,
      PENDING: 0,
      REJECTED: 0,
      CANCELLED: 0,
      RETURNED: 0,
      COLLECTED: 0,
    };

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
        });
      }

      const stat = statsMap.get(key);
      stat.count += 1;

      totalStatusCounts[status as BorrowStatus] += 1;
    });

    const formattedStats = Array.from(statsMap.values()).sort((a, b) =>
      a.year === b.year ? a.month - b.month : a.year - b.year
    );

    const calculateTrend = (current: number, previous: number) => {
      if (!previous) return { growth: current > 0, percentage: 100 };
      const change = ((current - previous) / previous) * 100;
      return { growth: change > 0, percentage: parseFloat(change.toFixed(2)) };
    };

    const lastPeriod = formattedStats.at(-1) || { count: 0 };
    const prevPeriod = formattedStats.at(-2) || { count: 0 };
    const borrowTrend = calculateTrend(lastPeriod.count, prevPeriod.count);

    res.status(200).json({
      success: true,
      message: "Borrow statistics fetched successfully",
      data: {
        totalBorrows: borrows.length,
        stats: formattedStats,
        trend: borrowTrend,
        ...{
          totalApproved: totalStatusCounts.APPROVED,
          totalPending: totalStatusCounts.PENDING,
          totalRejected: totalStatusCounts.REJECTED,
          totalCancelled: totalStatusCounts.CANCELLED,
          totalReturned: totalStatusCounts.RETURNED,
          totalCollected: totalStatusCounts.COLLECTED,
        },
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

  const hashedData = dataHasher(JSON.stringify(req.query));
  const cacheKey = `borrow:user:${hashedData}`;
  try {
    const cachedborrow = await redis.get(cacheKey);
    if (cachedborrow) {
      res.status(200).json({
        success: true,
        message: "User borrow fetched successfully",
        data: JSON.parse(cachedborrow),
      });
      return;
    }

    const userborrows = await prisma.borrows.findMany({
      where: { userId },
      include: {
        book: {
          select: {
            coverUrl: true,
            title: true,
          },
        },
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { [sortedBy]: sort === "desc" ? "desc" : "asc" },
      take,
      skip,
    });
    const totalBorrowedBook = await prisma.borrows.count({ where: { userId } });
    const totalPages = Math.ceil(totalBorrowedBook / take);
    const nextPage = totalPages - currentPage > 0 ? currentPage + 1 : null;

    await redis.setex(
      cacheKey,
      REDIS_CACHE_EXPIRY!,
      JSON.stringify({ userborrows, totalBorrowedBook, totalPages, nextPage })
    );
    res.status(200).json({
      success: true,
      message: "User borrow fetched successfully",
      data: { userborrows, totalBorrowedBook, totalPages, nextPage },
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

      message: "Missing borrowed book id param",
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
          NOT: {
            status: {
              in: [
                BorrowStatus.CANCELLED,
                BorrowStatus.COLLECTED,
                BorrowStatus.REJECTED,
                BorrowStatus.RETURNED,
              ],
            },
          },
        },
        data: { status: BorrowStatus.CANCELLED },
      });
      return newborrow;
    });

    await invalidateCache("borrow");
    await redis.setex(
      cacheKey,
      REDIS_CACHE_EXPIRY!,
      JSON.stringify(updatedborrow)
    );
    res.status(200).json({
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
  console.log("req.body", req.body);
  if (!borrowId) {
    res.status(400).json({
      error: true,

      message: "Missing borrowed book id param",
    });
    return;
  }

  if (!status) {
    res.status(400).json({
      error: true,

      message: "Missing status for book status update",
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
              in: [BorrowStatus.CANCELLED, status],
            },
          },
        },
        data: {
          status,
          returnDate: status === BorrowStatus.APPROVED ? returnDate : undefined,
          librarianId: userId,
        },
      });
      if (newborrow.status === BorrowStatus.APPROVED) {
        await prisma.books.update({
          where: { id: updatedborrow.bookId, availableCopies: { gt: 2 } },
          data: {
            availableCopies: { decrement: 1 },
            borrowCount: { increment: 1 },
          },
        });

        await scheduleBorrowReminder(updatedborrow.id);
      }
      return newborrow;
    });

    await invalidateCache("borrow");
    await redis.setex(
      cacheKey,
      REDIS_CACHE_EXPIRY!,
      JSON.stringify(updatedborrow)
    );

    res.status(200).json({
      success: true,
      message: `Borrowed book with book id ${borrowId} has been ${status}`,
      data: updatedborrow,
    });
  } catch (error) {
    console.log("error", error);
    next(error);
  }
};
