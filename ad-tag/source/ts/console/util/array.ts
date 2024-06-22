/**
 * Infers the type of an array's elements.
 *
 * Array<string> becomes string
 */
export type ArrayElement<ArrayType extends readonly unknown[]> =
  ArrayType extends readonly (infer ElementType)[] ? ElementType : never;
