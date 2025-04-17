import { REDIS_PASSWORD, REDIS_URL } from "./env";

const Redis = require("ioredis");

const redis = new Redis(REDIS_URL);

export default redis;

// password: REDIS_PASSWORD,
//   tls: {}, // Necessary for Upstash's SSL setup
