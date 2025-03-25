/**
 * If a callback is schedule on a page, and the page is refreshed, the callback should be called
 * on the new page accordingly. An object of this type is stored in session storage to determine
 * if the callback should be called or a new one should be scheduled.
 */
export interface ResumeCallbackData {
  /**
   * The timestamp, created via `Date.now()`, when this data was created.
   *
   * number of milliseconds elapsed since the epoch, which is defined as the midnight
   * at the beginning of January 1, 1970, UTC.   *
   */
  readonly ts: number;

  /**
   * The number of milliseconds to wait before the callback should be called.
   */
  readonly wait: number;
}

/**
 * A poor man's type for an "instant" function that returns the current timestamp.
 */
export type NowInstant = Pick<typeof globalThis, 'Date'>['Date']['now'];

/**
 *
 * @param data loaded data from session storage to determine if the callback should be called or a new one should be scheduled
 * @param now the current timestamp, created via `Date.now()`
 * @return the remaining time in milliseconds or 0 if the time has already passed
 */
export const remainingTime = (data: ResumeCallbackData, now: number): number => {
  return Math.max(data.wait - (now - data.ts), 0);
};
