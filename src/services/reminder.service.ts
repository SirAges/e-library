import prisma from "../config/prismaClient";
import  redis  from "../config/redisClient";
import { BorrowStatus } from "../lib/enums";
import { borrowReminderEmail, loginReminderEmail } from "../lib/html.string";
import { sendEmail } from "./email.service";

export const scheduleBorrowReminder = async (borrowId: number) => {
  const borrow = await prisma.borrows.findUnique({
    where: { id: borrowId },
    include: { user: true },
  });

  if (!borrow || borrow.status === BorrowStatus.RETURNED) return;

  const returnTime = new Date(borrow.returnDate).getTime();
  const now = Date.now();
  if (returnTime <= now) return;

  const reminderTime = now + (returnTime - now) * 0.75;
  const reminderKey = `borrow:reminder:${borrowId}`;

  await redis.zadd("borrow:reminders", reminderTime, reminderKey);
  await redis.set(
    reminderKey,
    JSON.stringify({ userId: borrow.userId, borrowId })
  );
};

export const scheduleLoginReminder = async (userId: number) => {
  const user = await prisma.users.findUnique({ where: { id: userId } });
  if (!user) return;

  const lastLoginTime = new Date(user.lastLogin).getTime();
  const reminderTime = lastLoginTime + 14 * 24 * 60 * 60 * 1000;
  if (Date.now() >= reminderTime) return;

  await redis.zadd("login:reminders", reminderTime, userId.toString());
};

const processBorrowReminders = async () => {
  const now = Date.now();
  const dueReminders = await redis.zrangebyscore("borrow:reminders", 0, now);

  for (const reminderKey of dueReminders) {
    const reminderData = await redis.get(reminderKey);
    if (!reminderData) continue;

    const { userId, borrowId } = JSON.parse(reminderData);
    const borrow = await prisma.borrows.findUnique({
      where: { id: borrowId },
      include: { user: true, book: true },
    });

    if (!borrow || borrow.status === BorrowStatus.RETURNED) {
      await redis.zrem("borrow:reminders", reminderKey);
      await redis.del(reminderKey);
      continue;
    }

    await sendEmail({
      html: borrowReminderEmail({
        borrowDate: borrow.borrowDate,
        returnDate: borrow.returnDate,
        title: borrow.book.title,
      }),
      to: borrow.user.email,
      subject: "Book Return Reminder",
    });

    await scheduleBorrowReminder(borrowId);

    await redis.zrem("borrow:reminders", reminderKey);
    await redis.del(reminderKey);
  }
};

const processLoginReminders = async () => {
  const now = Date.now();
  const dueUsers = await redis.zrangebyscore("login:reminders", 0, now);

  for (const userId of dueUsers) {
    const user = await prisma.users.findUnique({
      where: { id: parseInt(userId) },
    });
    if (!user) {
      await redis.zrem("login:reminders", userId);
      continue;
    }
    const lastLoginTime = new Date(user.lastLogin).getTime();
    const now = new Date();
    const diff = now.getTime() - lastLoginTime;
    const days = diff / (1000 * 60 * 60 * 24) + 7;
    const book = await prisma.books.findFirst({
      where: { year: { gte: 2020 } },
    });
    await sendEmail({
      html: loginReminderEmail({
        bookId: book?.id!,
        days,
        title: book?.title!,
      }),
      to: user.email,
      subject: "We Miss You!",
    });
    await redis.zrem("login:reminders", userId);
  }
};

setInterval(() => {
  processBorrowReminders();
  processLoginReminders();
}, 5000);
