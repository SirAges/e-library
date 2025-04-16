import { REDIS_PASSWORD, REDIS_URL } from "./env";

const Redis = require("ioredis");

const redis = new Redis({
  host:REDIS_URL,
  password: REDIS_PASSWORD,
  tls: {}, // Necessary for Upstash's SSL setup
});

export default redis