/**
 * To solve the Intersection Observer API typescript error
 * @see https://github.com/microsoft/TypeScript/issues/16255
 */
export type IntersectionObserverWindow = {
  IntersectionObserver: {
    prototype: IntersectionObserver;
    new (
      callback: IntersectionObserverCallback,
      options?: IntersectionObserverInit
    ): IntersectionObserver;
  };
};
