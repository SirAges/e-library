// **Generate and Hash OTP**
export const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

export const corsOptions = {};
