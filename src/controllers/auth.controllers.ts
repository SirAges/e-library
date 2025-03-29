import { NextFunction, Request as ExpressRequest, Response } from "express";
import prisma from "../config/prismaClient";
import bcrypt from "bcryptjs";
import { generateOTP } from "../lib/utils";
import {
  JWT_REFRESH_SECRET,
  JWT_REFRESH_TOKEN_EXPIRES_IN,
} from "../config/env";
import { sendEmail } from "../services/email.service";
import {
  generateTokens,
  setAppCookie,
  verifyToken,
} from "../services/token.service";
import { scheduleLoginReminder } from "../services/reminder.service";

interface Request extends ExpressRequest {
  uploadedFiles?: Record<string, CloudinaryFile>;
}
export const signIn = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  prisma.$transaction(async (tx) => {
    const { password, email } = req.body;
    try {
      if (!email) {
        res.status(400).json({
          success: false,
          error: true,
          message: `Your email is required to create an account. Please enter a valid email.`,
          data: null,
        });
        return;
      }

      if (!password) {
        res.status(400).json({
          success: false,
          error: true,
          message: `Your password is required to create an account. Please enter a secure password.`,
          data: null,
        });
        return;
      }

      const existingUser = await tx.users.findFirst({
        where: { email },
      });
      if (!existingUser) {
        res.status(401).json({
          success: false,
          error: true,
          message: "Please Sign up with email to sign in. user not found",
          data: null,
        });
        return;
      }

      if (!existingUser.isVerified) {
        res.status(403).json({
          success: false,
          error: true,
          message: `Your email address (${email}) has not been verified. Please verify your email to continue.`,
          data: null,
        });
        return;
      }

      const isPasswordValid = await bcrypt.compare(
        password,
        existingUser.password
      );
      if (!isPasswordValid) {
        res.status(401).json({
          success: false,
          error: true,
          message: `The password you entered is incorrect. Please check your password and try again.`,
          data: null,
        });
        return;
      }

      const { accessToken, refreshToken } = generateTokens({
        id: existingUser.id,
        role: existingUser.role!,
        email: existingUser.email,
      });
      setAppCookie(
        res,
        refreshToken,
        "refreshToken",
        parseInt(JWT_REFRESH_TOKEN_EXPIRES_IN!)
      );
      await tx.users.update({where:{id:existingUser.id},data:{
        lastLogin:new Date().toISOString()
      }})
      await scheduleLoginReminder(existingUser.id);
      res.status(200).json({
        success: true,
        error: false,
        message: `You have successfully signed in.`,
        data: accessToken,
      });
    } catch (error) {
      next(error);
    }
  });
};

export const signUp = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { email, password, lastName, firstName } = req.body;
  const { idCardUrl } = req.uploadedFiles!;

  await prisma.$transaction(async (tx) => {
    try {
      if (!email) {
        res.status(400).json({
          success: false,
          error: true,
          message: `Your email is required to create an account. Please enter a valid email.`,
          data: null,
        });
        return;
      }

      if (!password) {
        res.status(400).json({
          success: false,
          error: true,
          message: `Your password is required to create an account. Please enter a secure password.`,
          data: null,
        });
        return;
      }

      const existingUser = await tx.users.findFirst({
        where: { email },
        select: { isVerified: true },
      });
      // If user exists and is verified, return message
      if (existingUser && existingUser.isVerified) {
        res.status(400).json({
          success: false,
          error: true,
          message: `An account with this email address (${email}) already exists. Please sign in or use a different email.`,
          data: null,
        });
        return;
      }
      const otp = generateOTP();
      const hashedOTP = bcrypt.hashSync(otp, 12);
      const html = `<p>Your OTP code is:</p><h2>${otp}</h2><p>It expires in 5 minutes.</p>`;
      const subject = "OTP Verification";

      // If user exists and is NOT verified, send another OTP
      if (existingUser && !existingUser.isVerified) {
        setAppCookie(res, hashedOTP, "otp");

        await sendEmail({ to: email, html, subject });

        res.status(201).json({
          success: true,
          error: false,
          message: `A one-time password (OTP) has been sent to your email address (${email}). Please enter the OTP within 5 minutes to verify your account.`,
          data: null,
        });
        return;
      }

      const hashedPassword = await bcrypt.hash(password, 12);

      // Store user but not verified yet
      await tx.users.create({
        data: {
          email,
          password: hashedPassword,
          lastName,
          firstName,
          //@ts-ignore
          idCardUrl,
        },
      });

      // Store hashed OTP in cookie (Expires in 5 mins)
      setAppCookie(res, hashedOTP, "otp");

      await sendEmail({ to: email, html, subject });

      res.status(201).json({
        success: true,
        error: false,
        message: `A one-time password (OTP) has been sent to your email address (${email}). Please enter the OTP within 5 minutes to verify your account.`,
        data: null,
      });
    } catch (error) {
      next(error);
    }
  });
};

export const signOut = (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.clearCookie("refreshToken");

    res.status(200).json({
      success: true,
      error: false,
      message: `You have successfully signed out.`,
    });
  } catch (error) {
    next(error);
  }
};

export const refreshToken = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      res.status(401).json({
        success: false,
        error: true,
        message: `A refresh token is required to generate a new access token. Please provide a valid refresh token.`,
      });
      return;
    }
    const decoded = verifyToken(refreshToken, JWT_REFRESH_SECRET!);
    if (!decoded || typeof decoded === "string") {
      res.status(403).json({
        success: false,
        error: true,
        message: `The refresh token is invalid or has expired. Please sign in again to continue.`,
      });
      return;
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens({
      id: decoded.id,
      role: decoded.role,
      email: decoded.email,
    });
    setAppCookie(
      res,
      newRefreshToken,
      "refreshToken",
      parseInt(JWT_REFRESH_TOKEN_EXPIRES_IN!)
    );

    res.status(200).json({
      success: true,
      error: false,
      message: `Your access token has been refreshed successfully.`,
      data: accessToken,
    });
  } catch (error) {
    next(error);
  }
};

export const verifyOTP = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  await prisma.$transaction(async (tx) => {
    try {
      const { email, otp } = req.body;

      if (!email) {
        res.status(400).json({
          success: false,
          error: true,
          message: `Your email address is required to verify your account. Please provide a valid credentials.`,
          data: null,
        });
        return;
      }

      if (!otp) {
        res.status(400).json({
          success: false,
          error: true,
          message: `The OTP is required to complete your email verification. Please enter the OTP sent to your email.`,
          data: null,
        });
        return;
      }

      const user = await tx.users.findFirst({
        where: { email },
      });
      if (!user) {
        res.status(404).json({
          success: false,
          error: true,
          message: `No account is associated with the email address (${email}). Please check and try again.`,
          data: null,
        });
        return;
      }
      if (user.isVerified) {
        res.status(400).json({
          success: false,
          error: true,
          message: `User with this email address ${email} has already been verified`,
          data: null,
        });
        return;
      }
      const hashedOTP = req.cookies?.otp;

      if (!hashedOTP) {
        res.status(400).json({
          success: false,
          error: true,
          message: `The OTP has expired or is missing. Please request a new OTP and try again.`,
          data: null,
        });
        return;
      }
      const validateOtp = bcrypt.compareSync(otp, hashedOTP);

      if (!validateOtp) {
        res.status(400).json({
          success: false,
          error: true,
          message: `The OTP you entered is incorrect. Please check the code and try again.`,
          data: null,
        });
        return;
      }

      const data = await tx.users.update({
        data: { isVerified: true },
        where: { id: user.id },
      });

      if (data) {
        res.clearCookie("otp");
        res.status(200).json({
          success: true,
          error: false,
          message: `Your email address (${email}) has been successfully verified.`,
          data: null,
        });
      }
    } catch (error) {
      next(error);
    }
  });
};
