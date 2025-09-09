/**
 * Generate a UUID v4 through the window.crypto.randomUUID function if available.
 * @param window
 */
export const uuidV4 = (window: Window): string => {
  if (typeof window.crypto?.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  // this is a fallback for browsers that don't support window.crypto.randomUUID or the request
  // is not over https, localhost or 127.0.0.1 . This is not a secure way to generate a UUID,
  // but it doesn't matter as all major browsers support window.crypto.randomUUID and all websites
  // should be served over https.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    // eslint-disable-next-line no-bitwise
    const r = (Math.random() * 16) | 0;
    // eslint-disable-next-line no-bitwise
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};
