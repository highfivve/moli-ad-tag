type Conditional = [boolean, string];

/**
 * Creates a class list out of class names and conditional class names. Conditional class names are added when the
 * first value of the tuple is true.
 *
 * @param classNames  list of class names and conditional class names
 * @returns           class list string
 */
export function classList(...classNames: (string | Conditional)[]): string {
  let result = '';

  for (const i in classNames) {
    if (!classNames.hasOwnProperty(i)) {
      continue;
    }

    const className = classNames[i];
    if (typeof className === 'string') {
      result += `${className} `;
    } else {
      const conditionalClassName = (className as Conditional);
      if (conditionalClassName[0]) {
        result += `${conditionalClassName[1]} `;
      }
    }
  }

  return result.trim();
}
