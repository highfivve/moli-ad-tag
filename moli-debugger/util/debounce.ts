type DebouncedFunction = (...args: any[]) => void;

/**
 * Returns a debounced version of the given function.
 *
 * A debounced function is delayed until it hasn't been called for a given interval.
 *
 * @param callback  the function to be debounced
 * @param wait      debounce interval in ms
 * @returns         the debounced function
 */
export const debounce = (callback: Function, wait: number): DebouncedFunction => {
  let timeout: number | undefined;
  return function (...args: any[]): void {
    if (timeout) {
      window.clearTimeout(timeout);
    }
    timeout = window.setTimeout(function (): void {
      timeout = undefined;
      callback(...args);
    }, wait);
  };
};
