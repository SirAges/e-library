import nodemailer from "nodemailer";
import { EMAIL_HOST, EMAIL_PASS, EMAIL_PORT, EMAIL_USER } from "./env";

// **Configure Email Transporter**
const transporter = nodemailer.createTransport({
  //@ts-ignore
  host: EMAIL_HOST,
  port: EMAIL_PORT,
  secure: EMAIL_PORT === "465",
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
});
export default transporter;
