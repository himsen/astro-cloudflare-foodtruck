/**
 * Pre-order rules.
 *
 * Orders can be placed from the day before. Text messages are only read up to
 * a deadline on the day itself; after that the order has to be a phone call,
 * because nobody is looking at the phone's inbox while the grill is running.
 *
 * Pure and time-passed-in, so the cutoff is an ordinary unit test rather than
 * something you can only observe by waiting until four o'clock.
 */
export const SMS_DEADLINE = '16:00';

/** True while a text message will still be read for today's service. */
export function smsIsOpen(timeHHMM: string): boolean {
  // 'HH:MM' is zero-padded, so a string comparison is a time comparison.
  return timeHHMM < SMS_DEADLINE;
}
