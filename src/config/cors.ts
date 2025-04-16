const corsOption = {
  origin: (
    origin: string,
    callback: (err: Error | null, allow?: boolean) => void
  ) => {
    const allowedOrigins = ["http://localhost:5500", "http://localhost:3000"];

    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by cors"), false);
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization", "Accept-Version"],
  exposedHeaders: ["X-Total-Count", "Content-Range"],
  credentials: true,
  preflightContinue: false,
  maxAge: 600,
  optionsSuccessStatus: 204,
};

export default corsOption;
