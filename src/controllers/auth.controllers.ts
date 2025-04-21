import { NextFunction, Request as ExpressRequest, Response } from "express";
import prisma from "../config/prismaClient";
import bcrypt from "bcryptjs";
import { generateOTP } from "../lib/utils";
import {
  CLIENT_URL,
  JWT_ACCESS_TOKEN_EXPIRES_IN,
  JWT_REFRESH_SECRET,
  JWT_SECRET,
} from "../config/env";
import { sendEmail } from "../services/email.service";
import {
  generateTokens,
  setAppCookie,
  verifyToken,
} from "../services/token.service";
import { scheduleLoginReminder } from "../services/reminder.service";
import { verificationEmail } from "../lib/html.string";
import jwt from "jsonwebtoken";

interface Request extends ExpressRequest {
  uploadedFiles?: Record<string, CloudinaryFile>;
}

export const signIn = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { password, email } = req.body;
  try {
    if (!email) {
      res.status(400).json({
        error: true,
        message: `Your email is required to create an account. Please enter a valid email.`,
      });
      return;
    }

    if (!password) {
      res.status(400).json({
        error: true,
        message: `Your password is required to create an account. Please enter a secure password.`,
      });
      return;
    }

    const existingUser = await prisma.users.findFirst({
      where: { email },
    });
    if (!existingUser) {
      res.status(404).json({
        error: true,
        message: "Please Sign up with email to sign in. user not found",
      });
      return;
    }

    if (!existingUser.isVerified) {
      res.status(403).json({
        error: true,
        message: `Your email address (${email}) has not been verified. Please verify your email to continue.`,
      });
      return;
    }

    const isPasswordValid = await bcrypt.compare(
      password,
      existingUser.password
    );
    if (!isPasswordValid) {
      res.status(400).json({
        error: true,
        message: `The password you entered is incorrect. Please check your password and try again.`,
      });
      return;
    }

    const { accessToken, refreshToken } = generateTokens({
      userId: existingUser.id,
      role: existingUser.role!,
      email: existingUser.email,
    });
    setAppCookie(res, refreshToken, "refreshToken");
    await prisma.users.update({
      where: { id: existingUser.id },
      data: {
        lastLogin: new Date().toISOString(),
      },
    });
    await scheduleLoginReminder(existingUser.id);
    res.status(200).json({
      success: true,
      message: `You have successfully signed in.`,
      data: accessToken,
    });
  } catch (error) {
    next(error);
  }
};

export const signUp = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.log("req.body", req.body);
  const { email, password, lastName, firstName } = req.body;
  const { idCardUrl } = req.uploadedFiles!;
  try {
    if (!email) {
      res.status(400).json({
        error: true,
        message: `Your email is required to create an account. Please enter a valid email.`,
      });
      return;
    }

    if (!password) {
      res.status(400).json({
        error: true,
        message: `Your password is required to create an account. Please enter a secure password.`,
      });
      return;
    }

    const existingUser = await prisma.users.findFirst({
      where: { email },
      select: { isVerified: true },
    });
    // If user exists and is verified, return message
    if (existingUser && existingUser.isVerified) {
      res.status(409).json({
        error: true,
        message: `An account with this email address (${email}) already exists. Please sign in or use a different email.`,
      });
      return;
    }
    const otp = generateOTP();
    const hashedOTP = bcrypt.hashSync(otp, 12);
    const verificationToken = jwt.sign({ otp, email }, JWT_SECRET!, {
      expiresIn: `${parseInt(JWT_ACCESS_TOKEN_EXPIRES_IN!)}d`,
    });
    const url = `${CLIENT_URL}/auth/verify?token=${verificationToken}`;
    const html = verificationEmail({ url });
    const subject = "Email Verification";

    // If user exists and is NOT verified, send another OTP
    if (existingUser && !existingUser.isVerified) {
      setAppCookie(res, hashedOTP, "emailVerificationOTP");
      await sendEmail({ to: email, html, subject });
      res.status(201).json({
        success: true,
        message: `A one-time password (OTP) has been sent to your email address (${email}). Please enter the OTP within 5 minutes to verify your account.`,
      });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Store user but not verified yet
    await prisma.users.create({
      data: {
        email,
        password: hashedPassword,
        lastName,
        firstName,
        //@ts-ignore
        idCardUrl,
      },
    });

    setAppCookie(res, hashedOTP, "emailVerificationOTP");

    await sendEmail({ to: email, html, subject });

    res.status(201).json({
      success: true,

      message: `A one-time password (OTP) has been sent to your email address (${email}). Please enter the OTP within 5 minutes to verify your account.`,
    });
  } catch (error) {
    console.log("error", error);
    next(error);
  }
};

export const signOut = (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.clearCookie("refreshToken");
    res.status(200).json({
      success: true,
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
        error: true,
        message: `A refresh token is required to generate a new access token. Please provide a valid refresh token.`,
      });
      return;
    }
    const decoded = verifyToken(refreshToken, JWT_REFRESH_SECRET!);
    if (!decoded || typeof decoded === "string") {
      res.status(400).json({
        error: true,
        message: `The refresh token is invalid or has expired. Please sign in again to continue.`,
      });
      return;
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens({
      userId: decoded.userId,
      role: decoded.role,
      email: decoded.email,
    });
    setAppCookie(res, newRefreshToken, "refreshToken");

    res.status(200).json({
      success: true,
      message: `Your access token has been refreshed successfully.`,
      data: accessToken,
    });
  } catch (error) {
    next(error);
  }
};

export const verifyEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  await prisma.$transaction(async (tx) => {
    try {
      const { email, otp } = req.body;

      if (!email) {
        res.status(400).json({
          error: true,
          message: `Your email address is required to verify your account. Please provide a valid credentials.`,
        });
        return;
      }

      if (!otp) {
        res.status(400).json({
          error: true,
          message: `The OTP is required to complete your email verification. Please enter the OTP sent to your email.`,
        });
        return;
      }

      const user = await tx.users.findFirst({
        where: { email },
      });
      if (!user) {
        res.status(404).json({
          error: true,
          message: `No account is associated with the email address (${email}). Please check and try again.`,
        });
        return;
      }
      if (user.isVerified) {
        res.status(400).json({
          error: true,
          message: `User with this email address ${email} has already been verified`,
        });
        return;
      }
      const hashedOTP = req.cookies?.emailVerificationOTP;

      if (!hashedOTP) {
        res.status(404).json({
          error: true,
          message: `The OTP has expired or is missing. Please request a new OTP and try again.`,
        });
        return;
      }
      const validateOtp = bcrypt.compareSync(otp, hashedOTP);

      if (!validateOtp) {
        res.status(400).json({
          error: true,
          message: `The OTP you entered is incorrect. Please check the code and try again.`,
        });
        return;
      }

      const data = await tx.users.update({
        data: { isVerified: true },
        where: { id: user.id },
      });

      if (data) {
        res.clearCookie("emailVerificationOTP");
        res.status(200).json({
          success: true,

          message: `Your email address (${email}) has been successfully verified.`,
        });
      }
    } catch (error) {
      next(error);
    }
  });
};

export const forgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  await prisma.$transaction(async (tx) => {
    try {
      const { email } = req.body;

      if (!email) {
        res.status(400).json({
          error: true,
          message: `Your email address is required to verify your account. Please provide a valid credentials.`,
        });
        return;
      }

      const existingUser = await tx.users.findFirst({
        where: { email },
      });
      if (!existingUser) {
        res.status(404).json({
          success: true,
          message: `User with email address (${email}) not found.`,
        });
        return;
      }
      const otp = generateOTP();
      const hashedOTP = bcrypt.hashSync(otp, 12);
      const verificationToken = jwt.sign({ otp, email }, JWT_SECRET!, {
        expiresIn: `${parseInt(JWT_ACCESS_TOKEN_EXPIRES_IN!)}d`,
      });
      const url = `${CLIENT_URL}/auth/verify?token=${verificationToken}`;
      const html = verificationEmail({ url });
      const subject = "Password Reset OTP";
      setAppCookie(res, hashedOTP, "emailVerificationOTP");
      await sendEmail({ to: email, html, subject });

      res.status(200).json({
        success: true,

        message: `An OTP has been sent to this email address (${email}). Verify to create a new password.`,
      });
    } catch (error) {
      next(error);
    }
  });
};
