export const verificationEmail = ({ url }: { url: string }) => {
  const year = new Date().getFullYear();

  return `
 <div style="background-color: #0a0a0a; padding: 30px; font-family: Arial, Helvetica, sans-serif; color: #ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #1a1a1a; border-radius: 8px; overflow: hidden;">
    <!-- Header -->
    <tr>
      <td style="text-align: center; padding: 20px; background-color: #0d47a1; color: #ffffff; border-bottom: 1px solid #ffffff;">
        <h1 style="margin: 0; font-size: 1.8rem;">OTP Verification</h1>
      </td>
    </tr>

    <!-- Body -->
    <tr>
      <td style="text-align: center; padding: 30px;">
        <p style="font-size: 1rem; margin-bottom: 20px;">Use the button below to verify your email address.</p>
        <p style="font-size: 0.9rem; color: #cccccc; margin-bottom: 30px;">If you did not request this, please ignore this email.</p>

        <!-- Button -->
        <a href="${url}" style="display: inline-block; background-color: #1976d2; color: #ffffff; text-decoration: none; font-size: 1.5rem; font-weight: bold; padding: 15px 40px; border-radius: 5px; margin-bottom: 20px;">
          Verify Email
        </a>

        <p style="font-size: 0.9rem; color: #cccccc; margin-top: 20px;">Do not share this code with anyone.</p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="text-align: center; padding: 15px; font-size: 0.8rem; color: #888888; border-top: 1px solid #333333;">
        © readora ${year}
      </td>
    </tr>
  </table>
</div>
`;
};

export const borrowReminderEmail = ({
  borrowDate,
  returnDate,
  title,
}: {
  borrowDate: Date;
  returnDate: Date;
  title: string;
}) => {
  const getDate = (dt: Date) => new Date(dt).getDate();
  const date = new Date();
  const year = date.getFullYear();

  return `
  <div style="background-color: #0a0a0a; padding: 30px; font-family: Arial, Helvetica, sans-serif; color: #ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #1a1a1a; border-radius: 8px; overflow: hidden;">
    
    <!-- Header -->
    <tr>
      <td style="text-align: center; padding: 20px; background-color: #0d47a1; color: #ffffff; border-bottom: 1px solid #ffffff;">
        <h1 style="margin: 0; font-size: 1.8rem;">Book Return Reminder</h1>
      </td>
    </tr>

    <!-- Body -->
    <tr>
      <td style="text-align: center; padding: 30px;">
        <p style="font-size: 1.1rem; font-weight: bold; margin-bottom: 10px;">${title}</p>
        <p style="font-size: 1rem; color: #cccccc; margin-bottom: 20px;">
          This is a friendly reminder that the book you borrowed on <strong>${getDate(
            borrowDate
          )}</strong> 
          is due for return on <strong>${getDate(returnDate)}</strong>.
        </p>

        <p style="font-size: 1.2rem; margin-bottom: 15px;">Thank you for your cooperation!</p>
        <p style="font-size: 0.95rem; color: #bbbbbb; margin-bottom: 10px;">
          Failure to return the book on time may result in suspension from future borrowing privileges.
        </p>
        <p style="font-size: 0.85rem; color: #888888; font-weight: 600;">
          Note: Ensure that the librarian approves your return and it is reflected in your account.
        </p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="text-align: center; padding: 15px; font-size: 0.8rem; color: #888888; border-top: 1px solid #333333;">
        © readora ${year}
      </td>
    </tr>
  </table>
</div>
`;
};
export const loginReminderEmail = ({
  bookId,
  title,
  days,
}: {
  bookId: number;
  title: string;
  days: number;
}) => {
  const date = new Date();
  const year = date.getFullYear();

  return `
  <div style="background-color: #0a0a0a; padding: 30px; font-family: Arial, Helvetica, sans-serif; color: #ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #1a1a1a; border-radius: 8px; overflow: hidden;">
    
    <!-- Header -->
    <tr>
      <td style="text-align: center; padding: 20px; background-color: #0d47a1; color: #ffffff; border-bottom: 1px solid #ffffff;">
        <h1 style="margin: 0; font-size: 1.8rem;">Login Reminder</h1>
      </td>
    </tr>

    <!-- Body -->
    <tr>
      <td style="text-align: center; padding: 30px;">
        <p style="font-size: 1rem; margin-bottom: 10px;">It has been <strong>${days}</strong> days since you last logged in.</p>
        <p style="font-size: 1.5rem; font-weight: bold; margin: 10px 0;">We miss you!</p>
        <p style="font-size: 1rem; color: #cccccc; margin-bottom: 20px;">
          Readers are leaders. Borrow a book today and continue your journey to leadership.
        </p>

        <!-- Optional Book Button -->
        ${
          title && bookId
            ? `<a href="/books/${bookId}" 
                 style="display: inline-block; font-size: 1rem; padding: 12px 25px; color: #ffffff; background-color: #1976d2; text-decoration: none; font-weight: bold; border-radius: 5px; margin-top: 15px;">
                 ${title}
               </a>`
            : ""
        }
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="text-align: center; padding: 15px; font-size: 0.8rem; color: #888888; border-top: 1px solid #333333;">
        © readora ${year}
      </td>
    </tr>
  </table>
</div>
`;
};
