import Redis from "ioredis";
import { sendEmail } from "./email.service";
import { sendSMS } from "./sms.service";

const redis = new Redis();
const CHANNEL = "reminder_channel";

/**
 * Schedule a recursive reminder.
 * @param endDate - The final deadline timestamp (in seconds).
 * @param daysBefore - Days before the end date to start reminders.
 * @param email - Optional recipient email.
 * @param phone - Optional recipient phone.
 * @param message - SMS message content.
 * @param subject - Email subject.
 * @param body - Email body.
 */
export const sendReminder = async (
  endDate: number,
  daysBefore: number,
  email?: string,
  phone?: string,
  message?: string,
  subject?: string,
  body?: string
) => {
  const now = Math.floor(Date.now() / 1000);
  const initialReminder = endDate - daysBefore * 24 * 60 * 60; // Convert days to seconds

  if (initialReminder <= now) {
    console.error("Initial reminder time is in the past. Skipping.");
    return;
  }

  const reminderId = `reminder:${endDate}:${daysBefore}`;
  const reminderData = JSON.stringify({
    endDate,
    daysBefore,
    email,
    phone,
    message,
    subject,
    body,
  });

  // Store in Redis sorted set
  await redis.zadd("reminders", initialReminder, reminderId);
  await redis.set(reminderId, reminderData);

  console.log(
    `Scheduled first reminder for ${new Date(initialReminder * 1000)}`
  );

  // Publish to trigger processing
  await redis.publish(CHANNEL, reminderId);
};

/**
 * Process a reminder and schedule the next one recursively.
 */
const processReminder = async (reminderId: string) => {
  const reminderData = await redis.get(reminderId);
  if (!reminderData) return;

  const { endDate, daysBefore, email, phone, message, subject, body } =
    JSON.parse(reminderData);
  const now = Math.floor(Date.now() / 1000);

  if (endDate <= now) {
    console.log(
      `Final reminder reached for ${reminderId}. No further reminders.`
    );
    await redis.del(reminderId);
    await redis.zrem("reminders", reminderId);
    return;
  }

  // Send the reminder
  try {
    if (email) await sendEmail(email, subject, body);
    if (phone) await sendSMS(phone, message);
    console.log(`Reminder sent: ${reminderId}`);
  } catch (error) {
    console.error(`Failed to send reminder: ${reminderId}`, error);
  }

  // Calculate next interval
  const nextInterval = daysBefore / 2;
  if (nextInterval < 0.5) return; // Stop if interval becomes too small (e.g., < 12 hours)

  const nextReminderTime = Math.floor(now + nextInterval * 24 * 60 * 60); // Convert days to seconds
  const nextReminderId = `reminder:${endDate}:${nextInterval}`;
  const nextReminderData = JSON.stringify({
    endDate,
    daysBefore: nextInterval,
    email,
    phone,
    message,
    subject,
    body,
  });

  // Store next reminder
  await redis.zadd("reminders", nextReminderTime, nextReminderId);
  await redis.set(nextReminderId, nextReminderData);
  await redis.publish(CHANNEL, nextReminderId);

  console.log(
    `Scheduled next reminder for ${new Date(nextReminderTime * 1000)}`
  );

  // Cleanup old reminder
  await redis.del(reminderId);
  await redis.zrem("reminders", reminderId);
};

/**
 * Restore scheduled reminders on service restart.
 */
export const restoreReminders = async () => {
  const now = Math.floor(Date.now() / 1000);
  const reminderKeys = await redis.zrangebyscore("reminders", "-inf", now);

  for (const key of reminderKeys) {
    await processReminder(key);
  }
};

/**
 * Listen for new reminders and schedule processing.
 */
const subscribeToReminders = async () => {
  const subscriber = new Redis();

  subscriber.subscribe(CHANNEL);
  subscriber.on("message", async (_, reminderId) => {
    const sendAt = parseInt(reminderId.split(":")[1]);
    const now = Math.floor(Date.now() / 1000);
    const delay = Math.max(sendAt - now, 0) * 1000;

    setTimeout(() => processReminder(reminderId), delay);
  });
};

// Start the subscriber and restore previous reminders
subscribeToReminders();
restoreReminders();
