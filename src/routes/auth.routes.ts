import { Router } from "express";

import {
  forgotPassword,
  refreshToken,
  signIn,
  signOut,
  signUp,
  verifyEmail,
} from "../controllers/auth.controllers";
import uploadFile from "../middlewares/upload.middleware";
import {
  validateSignIn,
  validateSignUp,
  validateVerifyOtp,
} from "../middlewares/validation.middleware";
import upload from "../config/multer";

const authRouter = Router();

authRouter.post("/sign-in", validateSignIn, signIn);
authRouter.post("/sign-up",upload, validateSignUp, uploadFile, signUp);
authRouter.post("/sign-out", signOut);
authRouter.post("/refresh-token", refreshToken);
authRouter.post("/verify-otp", validateVerifyOtp, verifyEmail);
authRouter.post("/forgot-password", forgotPassword);

export default authRouter;
