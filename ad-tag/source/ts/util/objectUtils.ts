export function isPlainObject(object: any): boolean {
  return toString.call(object) === '[object Object]';
}

/**
 * Merges objects and arrays.
 *
 * @param target the target object in which things will be merged
 * @param sources objects being merged into the target
 * @see https://stackoverflow.com/questions/27936772/how-to-deep-merge-instead-of-shallow-merge
 * @see https://github.com/prebid/Prebid.js/blob/41be379034ea952a28a257784c7eb53fa5c15d95/src/utils.js#L1234-L1253
 */
export function mergeDeep(target: object, ...sources: any[]): any {
  if (!sources.length) return target;
  const source = sources.shift();

  if (isPlainObject(target) && isPlainObject(source)) {
    for (const key in source) {
      if (isPlainObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        mergeDeep(target[key], source[key]);
      } else if (Array.isArray(source[key])) {
        if (!target[key]) {
          Object.assign(target, { [key]: source[key] });
        } else if (Array.isArray(target[key])) {
          target[key] = target[key].concat(source[key]);
        }
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return mergeDeep(target, ...sources);
}
