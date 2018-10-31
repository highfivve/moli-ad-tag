/**
 * == Lazy Loader ==
 *
 * Class to define lazy loading logic for Ads.
 *
 */
export interface ILazyLoader {

  /**
   * @returns {Promise<void>} a promise that resolves when the lazy loaded content should be triggered
   */
  onLoad(): Promise<void>;
}

/**
 * When the footer is visible the lazy loading logic is triggered.
 *
 * TODO: real implementation
 *
 * @returns {ILazyLoader} a lazy loader
 */
export const FooterVisible = (): ILazyLoader => {

  return {
    onLoad(): Promise<void> {
      return Promise.resolve();
    }
  };
};

/**
 * Resolves the ad slot when the sidebar is tall enough for this ad slot.
 *
 * TODO: real implementation
 *
 * @returns {ILazyLoader}
 */
export const QdpSidebar2Loaded = (): ILazyLoader => {

  return {
    onLoad(): Promise<void> {
      return Promise.resolve();
    }
  };
};
