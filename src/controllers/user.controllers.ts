import { NextFunction, Request, Response } from "express";
import prisma from "../config/prismaClient";
import redis from "../config/redisClient";
import bcrypt from "bcryptjs";
import { REDIS_CACHE_EXPIRY_SECONDS } from "../config/env";
import {
  dataHasher,
  deleteMediaFromCloudinary,
  invalidateCache,
} from "../lib/utils";
import { JsonObject } from "@prisma/client/runtime/library";

const REDIS_CACHE_EXPIRY = parseInt(REDIS_CACHE_EXPIRY_SECONDS!);

export const getUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const {
    sort = "desc",
    limit = "10",
    page = "1",
    sortBy = "createdAt",
  } = req.query;

  const hashedData = dataHasher(JSON.stringify(req.query));
  const cacheKey = `user:all:${hashedData}`;

  const currentPage = parseInt(page.toString(), 10);
  const take = parseInt(limit.toString(), 10);
  const skip = (currentPage - 1) * take;
  const sortedBy = sortBy?.toString();

  try {
    const cachedUser = await redis.get(cacheKey);
    if (cachedUser) {
      res.status(200).json({
        success: true,
        message: "Users fetched cache successfully",
        data: JSON.parse(cachedUser),
      });
      return;
    }
    const users = await prisma.users.findMany({
      orderBy: { [sortedBy]: sort === "desc" ? "desc" : "asc" },
      take,
      skip,
      omit: {
        updatedAt: true,
        password: true,
      },
    });

    const totalUsers = await prisma.users.count();
    const totalPages = Math.ceil(totalUsers / take);
    const nextPage = totalPages - currentPage > 0 ? currentPage + 1 : null;

    await redis.setex(
      cacheKey,
      REDIS_CACHE_EXPIRY!,
      JSON.stringify({ users, totalUsers, totalPages, nextPage })
    );

    res.status(200).json({
      success: true,
      message: "Users fetched successfully",
      data: { users, totalUsers, totalPages, nextPage },
    });
  } catch (error) {
    console.log("error", error);
    next(error);
  }
};

export const getUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      res.status(400).json({
        error: true,

        message: "Missing user id param",
      });
      return;
    }

    const cacheKey = `user:${userId}`;
    const cachedUser = await redis.get(cacheKey);

    if (cachedUser) {
      res.status(200).json({
        success: true,
        message: "User fetched successfully.",
        data: JSON.parse(cachedUser),
      });
      return;
    }
    const user = await prisma.users.findUnique({
      where: { id: parseInt(userId) },
      omit: {
        updatedAt: true,
        password: true,
      },
    });

    if (!user) {
      res.status(404).json({
        error: true,

        message: "User not found",
      });
      return;
    }

    await redis.setex(cacheKey, REDIS_CACHE_EXPIRY!, JSON.stringify(user));

    res.status(200).json({
      success: true,
      message: "User fetched successfully",
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      res.status(400).json({
        error: true,

        message: "Missing user id param",
      });
      return;
    }
    const cacheKey = `user:${userId}`;

    const data = req.body;
    let hashedPassword = undefined;
    if (data?.password) {
      hashedPassword = await bcrypt.hash(data.password, 12);
    }
    const updatedUser = await prisma.$transaction(async (tx) => {
      return tx.users.update({
        where: { id: parseInt(userId) },
        data: { ...data, password: hashedPassword },
        omit: {
          updatedAt: true,
          password: true,
        },
      });
    });
    await invalidateCache("user");
    await redis.setex(
      cacheKey,
      REDIS_CACHE_EXPIRY!,
      JSON.stringify(updatedUser)
    );
    res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      res.status(400).json({
        error: true,

        message: "Missing user id param",
      });
      return;
    }

    await prisma.$transaction(async (tx) => {
      const deletedUser = await tx.users.delete({
        where: { id: parseInt(userId) },
        select: { idCardUrl: true },
      });
      const idCardUrl = deletedUser.idCardUrl as JsonObject;
      if (idCardUrl) {
        await deleteMediaFromCloudinary(idCardUrl.public_id as string);
      }
      await redis.del(`user:${userId}`);
      await invalidateCache("user");
      res.status(200).json({
        success: true,
        message: "User deleted successfully",
      });
    });
  } catch (error) {
    next(error);
  }
};

export const userStatistics = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const threeYearsAgo = new Date();
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);

    const totalStats = await prisma.users.aggregate({
      where: { createdAt: { gte: threeYearsAgo } },
      _count: { id: true },
    });

    const stats = await prisma.users.groupBy({
      by: ["createdAt", "role", "status", "isVerified"],
      where: { createdAt: { gte: threeYearsAgo } },
      _count: { id: true },
      orderBy: { createdAt: "asc" },
    });

    const userStatsMap = new Map();

    stats.forEach((item) => {
      const date = new Date(item.createdAt);
      const key = `${date.getFullYear()}-${date.getMonth() + 1}`;

      if (!userStatsMap.has(key)) {
        userStatsMap.set(key, {
          year: date.getFullYear(),
          month: date.getMonth() + 1,
          count: 0,
          roles: {
            STUDENT: 0,
            LIBRARIAN: 0,
            ADMIN: 0,
          },
          statuses: {
            ACTIVE: 0,
            INACTIVE: 0,
            SUSPENDED: 0,
          },
          verified: 0,
          unverified: 0,
        });
      }

      const userData = userStatsMap.get(key);
      userData.count += item._count.id;
      userData.roles[item.role] =
        (userData.roles[item.role] || 0) + item._count.id;
      userData.statuses[item.status] =
        (userData.statuses[item.status] || 0) + item._count.id;

      if (item.isVerified) {
        userData.verified += item._count.id;
      } else {
        userData.unverified += item._count.id;
      }
    });

    const formattedStats = Array.from(userStatsMap.values());

    const totalRoles = await prisma.users.groupBy({
      by: ["role"],
      where: { createdAt: { gte: threeYearsAgo } },
      _count: { id: true },
    });

    const totalStatuses = await prisma.users.groupBy({
      by: ["status"],
      where: { createdAt: { gte: threeYearsAgo } },
      _count: { id: true },
    });

    const totalRolesCount = { STUDENT: 0, LIBRARIAN: 0, ADMIN: 0 };
    totalRoles.forEach((item) => {
      totalRolesCount[item.role] = item._count.id;
    });

    const totalStatusesCount = { ACTIVE: 0, INACTIVE: 0, SUSPENDED: 0 };
    totalStatuses.forEach((item) => {
      totalStatusesCount[item.status] = item._count.id;
    });

    const totalVerified = await prisma.users.count({
      where: { isVerified: true },
    });
    const totalUnverified = await prisma.users.count({
      where: { isVerified: false },
    });

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

    const userTrend = calculateTrend(lastPeriod.count, prevPeriod.count);

    res.status(200).json({
      success: true,
      message: "User statistics fetched successfully",
      data: {
        totalUsers: totalStats._count.id || 0,
        totalRoles: totalRolesCount,
        totalStatuses: totalStatusesCount,
        totalVerified,
        totalUnverified,
        stats: formattedStats,
        trend: userTrend,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const searchUsers = async (
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
  } = req.query;
  const hashedData = dataHasher(JSON.stringify(req.query));
  const cacheKey = `user:search:${hashedData}`;

  const currentPage = parseInt(page.toString(), 10);
  const take = parseInt(limit.toString(), 10);
  const skip = (currentPage - 1) * take;
  const sortedBy = sortBy?.toString();

  try {
    if (!query) {
      res.status(400).json({
        success: true,
        message: "serach query is required",
      });
      return;
    }
    const searchQuery = query.toString();
    const cachedUser = await redis.get(cacheKey);
    if (cachedUser) {
      res.status(200).json({
        success: true,
        message: "Users fetched successfully",
        data: JSON.parse(cachedUser),
      });
      return;
    }
    const users = await prisma.users.findMany({
      where: {
        OR: [
          { firstName: { contains: searchQuery, mode: "insensitive" } },
          { lastName: { contains: searchQuery, mode: "insensitive" } },
        ],
      },
      orderBy: { [sortedBy]: sort === "desc" ? "desc" : "asc" },
      take,
      skip,
      omit: {
        updatedAt: true,
        password: true,
      },
    });

    const totalUsers = users.length;
    const totalPages = Math.ceil(totalUsers / take);
    const nextPage = totalPages - currentPage > 0 ? currentPage + 1 : null;

    await redis.setex(
      cacheKey,
      REDIS_CACHE_EXPIRY!,
      JSON.stringify({ users, totalUsers, totalPages, nextPage })
    );

    res.status(200).json({
      success: true,
      message: "Users fetched successfully",
      data: { users, totalUsers, totalPages, nextPage },
    });
  } catch (error) {
    next(error);
  }
};
