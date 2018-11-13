/**
 * Until https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/flat has landed
 *
 * @param arr the 2-dimensional array to flatten
 */
export function flatten<T>(arr: T[][]): Array<T> {
  return arr.reduce((acc, val) => acc.concat(val), []);
}
