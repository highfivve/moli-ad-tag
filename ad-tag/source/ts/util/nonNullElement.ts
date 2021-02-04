// https://stackoverflow.com/questions/43118692/typescript-filter-out-nulls-from-an-array
export const nonNullElement = <T>(item: T | null | undefined): item is T => !!item;
