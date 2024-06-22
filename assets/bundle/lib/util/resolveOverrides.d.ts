export type OverrideValue<T> = {
    source: 'queryParam' | 'localStorage' | 'sessionStorage';
    value: T;
};
export declare const resolveOverrides: <T extends string = string>(window: Window, queryParam: string, storageKey: string, predicate?: (value: string) => value is T) => OverrideValue<T>[];
