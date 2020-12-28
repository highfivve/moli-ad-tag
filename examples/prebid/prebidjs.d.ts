/**
 * This is inlined for initial testing. We may add this typings to the
 * ad tag once we are sure this is something we want.
 */
declare module 'prebid.js' {
  export interface PrebidJs {
    processQueue(): void;
  }

  const pbjs: PrebidJs;
  export default pbjs;
}
