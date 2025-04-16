
export const verificationEmail = ({ url }: { url: string }) => {
  const year = new Date().getFullYear();

  return `
  <div style="background-color: whitesmoke; padding: 20px; font-family: Verdana, Geneva, Tahoma, sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto;">
      <tr>
        <td style="text-align: center; padding: 10px; color: burlywood; border-bottom: 1px solid;">
          <h1>OTP Verification Email</h1>
        </td>
      </tr>
      <tr>
        <td style="text-align: center; padding: 10px;">
          <p>Use this OTP to verify your email</p>
          <p style="font-size: 1rem;">If you did not initiate this request, you can ignore it</p>
          <div style="display: inline-block; background-color: burlywood; padding: 10px 20px; color: whitesmoke; border-radius: 5px; margin: 10px 0;">
            <a href="${url}" style="font-size: 3rem; font-weight: bold; margin: 0;">Verify Email</a>
          </div>
          <p>Do not share this code with anyone</p>
          <p>© Labook ${year}</p>
        </td>
      </tr>
    </table>
  </div>`;
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
  <div style="background-color: whitesmoke; padding: 20px; font-family: Verdana, Geneva, Tahoma, sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto;">
      <tr>
        <td style="text-align: center; padding: 10px; color: burlywood; border-bottom: 1px solid;">
          <h1>Book Return Reminder Email</h1>
        </td>
      </tr>
      <tr>
        <td style="text-align: center; padding: 10px;">
          <p style="font-size: medium;">${title}</p>
          <p>This is to remind you that this book borrowed on ${getDate(
            borrowDate
          )} will be due for return on ${getDate(returnDate)}</p>
          <p style="font-size: 2rem;">Thank you for your cooperation</p>
          <p>Failure to return the book will result in suspension from future borrows.</p>
          <p style="font-size: small; font-weight: 600;">Note: Make sure the librarian approves your return and it is reflected in your account.</p>
        </td>
      </tr>
      <tr>
        <td style="text-align: center; padding: 10px;">
          <p>Do not share this code with anyone</p>
          <p>© Labook ${year}</p>
        </td>
      </tr>
    </table>
  </div>`;
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
  <div style="background-color: whitesmoke; padding: 20px; font-family: Verdana, Geneva, Tahoma, sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto;">
      <tr>
        <td style="text-align: center; padding: 10px; color: burlywood; border-bottom: 1px solid;">
          <h1>Login Reminder</h1>
        </td>
      </tr>
      <tr>
        <td style="text-align: center; padding: 10px;">
          <p>It has been ${days} days since you last logged in</p>
          <p style="font-size: 2rem; margin: 0;">We miss you</p>
          <p>Readers are leaders. Borrow a book today and continue your journey to leadership</p>
        </td>
      </tr>
      ${
        title && bookId
          ? `<tr>
              <td style="text-align: center; padding: 10px;">
                <a href="/books/${bookId}the_beginning_of_power" 
                   style="display: inline-block; font-size: 14px; padding: 10px; color: chocolate; text-decoration: none; font-weight: 600; border: 1px solid; background-color: #fff8ef; border-radius: 5px;">
                   ${title}
                </a>
              </td>
            </tr>`
          : ""
      }
      <tr>
        <td style="text-align: center; padding: 10px;">
          <p>Do not share this code with anyone</p>
          <p>© Labook ${year}</p>
        </td>
      </tr>
    </table>
  </div>`;
};
