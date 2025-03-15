const MockIntersectionObserver = class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = '0';
  readonly thresholds: ReadonlyArray<number> = [];
  constructor(
    callback?: IntersectionObserverCallback | undefined,
    options?: IntersectionObserverInit | undefined
  ) {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
  }
  observe() {
    return;
  }
  unobserve() {
    return;
  }

  disconnect(): void {
    return;
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
};

export { MockIntersectionObserver };
