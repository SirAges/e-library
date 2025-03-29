import prisma from "../config/prismaClient";
import { redis } from "../config/redisClient";
import { borrowReminderEmail, loginReminderEmail } from "../lib/html.string";
import { sendEmail } from "./email.service";

export const scheduleBorrowReminder = async (borrowId: number) => {
  const borrow = await prisma.borrows.findUnique({
    where: { id: borrowId },
    include: { user: true },
  });

  if (!borrow || borrow.status === "RETURNED") return;

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
      include: { user: true },
    });

    if (!borrow || borrow.status === "RETURNED") {
      await redis.zrem("borrow:reminders", reminderKey);
      await redis.del(reminderKey);
      continue;
    }

    await sendEmail({
      html: borrowReminderEmail,
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

    await sendEmail({
      html: loginReminderEmail,
      to: user.email,
      subject: "We Miss You!",
    });
    await redis.zrem("login:reminders", userId);
  }
};

setInterval(() => {
  processBorrowReminders();
  processLoginReminders();
}, 60000);


