/**
 * Check if the value is a real object and not an array or null.
 * @param value - The value to check.
 */
export const isPlainObject = (value: any): value is object =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Deep copy of a value a merge is about to take from a source.
 *
 * Plain objects already get copied by `mergeDeep` recursing into a fresh `{}`, but arrays used
 * to be taken by reference. That let a merge result share an array with its source, so a later
 * `push` on the result wrote back into the source - e.g. the prebid first party data module
 * appending IAB categories into the publisher's static `targeting.ortb2`, once per `requestAds()`.
 *
 * @param value the value being taken from a source
 */
const copyMergedValue = (value: any): any => {
  if (Array.isArray(value)) {
    return value.map(copyMergedValue);
  }
  if (isPlainObject(value)) {
    return mergeDeep({}, value);
  }
  return value;
};

/**
 * Merges objects and arrays.
 *
 * Objects are merged recursively, arrays are concatenated and everything else is overwritten by
 * the later source. Nothing the target takes from a source is shared with it: the result can be
 * mutated freely without reaching back into any of the sources.
 *
 * Note that `target` itself is mutated and returned.
 *
 * @param target the target object in which things will be merged
 * @param sources objects being merged into the target
 * @see https://stackoverflow.com/questions/27936772/how-to-deep-merge-instead-of-shallow-merge
 * @see https://github.com/prebid/Prebid.js/blob/41be379034ea952a28a257784c7eb53fa5c15d95/src/utils.js#L1234-L1253
 */
export function mergeDeep(target: object, ...sources: any[]): any {
  if (!sources.length) {
    return target;
  }
  const source = sources.shift();

  if (isPlainObject(target) && isPlainObject(source)) {
    for (const key in source) {
      if (isPlainObject(source[key])) {
        if (!target[key]) {
          Object.assign(target, { [key]: {} });
        }
        mergeDeep(target[key], source[key]);
      } else if (Array.isArray(source[key])) {
        if (!target[key]) {
          Object.assign(target, { [key]: copyMergedValue(source[key]) });
        } else if (Array.isArray(target[key])) {
          target[key] = target[key].concat(copyMergedValue(source[key]));
        }
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return mergeDeep(target, ...sources);
}
