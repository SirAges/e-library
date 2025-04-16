import { config } from "dotenv";
config({
  path: "./.env",
  override: false,
  debug: false,
  encoding: "utf8",
});
export const {
  NODE_ENV,
  DATABASE_URL,
  REDIS_URL,
  REDIS_PASSWORD,
  PORT,
  EMAIL_HOST,
  EMAIL_PORT,
  EMAIL_USER,
  EMAIL_PASS,
  JWT_SECRET,
  JWT_REFRESH_SECRET,
  JWT_ACCESS_TOKEN_EXPIRES_IN,
  JWT_REFRESH_TOKEN_EXPIRES_IN,
  REDIS_CACHE_EXPIRY_SECONDS,
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
  CLIENT_URL,
} = process.env;
