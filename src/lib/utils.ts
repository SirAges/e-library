import cloudinary from "../config/cloudinary";
import redis from "../config/redisClient";
import logger from "../services/logger.service";
import crypto from "crypto";
// **Generate and Hash OTP**
export const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

export const invalidateCache = async (cache: string) => {
  const cacheKey = await redis.keys(`${cache}:*`);
  if (cacheKey.length > 0) {
    await redis.del(cacheKey);
  }
};

export const deleteMediaFromCloudinary = async (publicId: string) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    logger.info("Media deleted successfuly from cloud stroage", publicId);
    return result;
  } catch (error) {
    logger.error("Error deleting media from cludinary", error);
    throw error;
  }
};

export const dataHasher = (data: string) => {
  const hashedData = crypto.createHash("sha256").update(data).digest("hex");
  return hashedData;
};
