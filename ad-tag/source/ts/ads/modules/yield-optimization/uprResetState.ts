/**
 * Sticky UPR Reset state, keyed by ad unit path.
 *
 * Once an ad unit path is marked as reset - via the Empty Refresh trigger - it stays reset for
 * the rest of the page session, regardless of DOM id or SPA navigation.
 *
 * @see docs/adr/0003-upr-reset-on-empty-or-sub-floor-bid.md
 */
export interface UprResetState {
  /**
   * True if the given ad unit path's floor has already been reset in this page session.
   */
  isReset(adUnitPath: string): boolean;

  /**
   * Marks the given ad unit path as reset for the rest of the page session. Idempotent.
   */
  markReset(adUnitPath: string): void;
}

export const createUprResetState = (): UprResetState => {
  const resetAdUnitPaths = new Set<string>();

  return {
    isReset: adUnitPath => resetAdUnitPaths.has(adUnitPath),
    markReset: adUnitPath => {
      resetAdUnitPaths.add(adUnitPath);
    }
  };
};
