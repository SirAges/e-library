import { Router } from "express";

import {
  refreshToken,
  signIn,
  signOut,
  signUp,
  verifyOTP,
} from "../controllers/auth.controllers";
import upload from "../config/multer";
import uploadFile from "../middlewares/upload.middleware";
import {
  validateSignIn,
  validateSignUp,
  validateVerifyOtp,
} from "../middlewares/validation.middleware";

const authRouter = Router();

authRouter.post("/sign-in", validateSignIn, signIn);
authRouter.post("/sign-up", validateSignUp, upload, uploadFile, signUp);
authRouter.post("/sign-out", signOut);
authRouter.post("/refresh-token", refreshToken);
authRouter.post("/verify-otp", validateVerifyOtp, verifyOTP);

export default authRouter;
