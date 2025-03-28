import transporter from "../config/email";
import { EMAIL_USER } from "../config/env";

type SendEmail = {
  to: string;
  subject: string;
  html: string;
};
export const sendEmail = async ({ subject, html, to }: SendEmail) => {
  await transporter.sendMail({
    from: `"No-Reply" <${EMAIL_USER}>`,
    to,
    subject,
    html,
  });
};
