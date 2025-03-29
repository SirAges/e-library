import { CorsOptions, CorsOptionsDelegate, CorsRequest } from "cors";
import { SourceOrigin } from "node:module";

const corsOption = {
  //origin -> this will tell that which origins you want user can access your api
  origin: (
    origin: string,
    callback: (err: Error | null, allow?: boolean) => void
  ) => {
    const allowedOrigins = [
      "http://localhost:5500", //local dev
      "https://yourcustomdomain.com", //production domain
    ];

    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true); //giving permission so that req can be allowed
    } else {
      callback(new Error("Not allowed by cors"), false);
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization", "Accept-Version"],
  exposedHeaders: ["X-Total-Count", "Content-Range"],
  credentials: true, //enable support for cookies,
  preflightContinue: false,
  maxAge: 600, // cache pre flight responses for 10 mins  (600 seconds) -> avoid sending options requests multiple times
  optionsSuccessStatus: 204,
};

export default corsOption;
