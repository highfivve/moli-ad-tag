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
 *
 * @param data loaded data from session storage to determine if the callback should be called or a new one should be scheduled
 * @param now the current timestamp, created via `Date.now()`
 * @param callback invoked either directly or through a new scheduled `setTimeout` call
 * @param _window an object that supports a `setTimeout` method - usually window
 */
export const resume = (
  data: ResumeCallbackData,
  now: number,
  callback: () => void,
  _window: Pick<Window, 'setTimeout'>
) => {
  const diff = now - data.ts;
  if (diff >= data.wait) {
    callback();
  } else {
    _window.setTimeout(callback, data.wait - diff);
  }
};
