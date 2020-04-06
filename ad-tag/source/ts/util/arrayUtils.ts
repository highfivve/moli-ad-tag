/**
 * Until https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/flat has landed
 *
 * @param arr the 2-dimensional array to flatten
 */
export function flatten<T>(arr: T[][]): Array<T> {
  return arr.reduce((acc, val) => acc.concat(val), []);
}

export function uniquePrimitiveFilter<T>(elm: T, position: number, arr: T[]): boolean {
  return arr.indexOf(elm) === position;
}

/**
 * filter out all elements that are null or undefined in an array
 * @param elem
 */
export function isNotNull<T>(elem: T | null | undefined): elem is T {
  return elem !== null && elem !== undefined;
}
