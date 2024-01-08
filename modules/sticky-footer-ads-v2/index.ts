/**
 * # Sticky Footer Ads
 *
 * Out of page formats for mobile and desktop that are sticky at the bottom of the page.
 * This is similar to the [Anchor Ads](https://developers.google.com/publisher-tag/samples/display-anchor-ad) provided
 * by Google Ad Manager.
 *
 * ## Integration
 *
 * In your `index.ts` import and register the module.
 *
 * ```js
 * moli.registerModule(
 *   new NewStickyFooterAds({
 *     stickyFooterDomIds: {
 *       mobile: 'ad-mobile-sticky',
 *       desktop: 'ad-desktop-sticky'
 *      },
 *     disallowedAdvertiserIds: []
 *      })
 *     );
 * ```
 *
 * Next you need to add the required HTML and CSS on your page. See the [footer ads documentation](https://highfivve.github.io/footer-ads/) .. TO DO )
 *
 * ## Resources
 *
 * - [Documentation](https://highfivve.github.io/footer-ads/)
 *
 * @module
 */
import {
  AdPipeline,
  IAssetLoaderService,
  IModule,
  LOW_PRIORITY,
  mkPrepareRequestAdsStep,
  ModuleType,
  Moli
} from '@highfivve/ad-tag';
import { initAdSticky } from './footerStickyAd';

export type Device = 'mobile' | 'desktop';

export type FooterDomIds = { [device in Device]?: string };

export type StickyFooterAdConfig = {
  readonly stickyFooterDomIds: FooterDomIds;

  /**
   * Disable rendering the footer ad format for certain advertisers by specifying them here.
   * Most of the time you would use this for partners who ship their own special format or behaviour.
   */
  readonly disallowedAdvertiserIds: number[];

  readonly closingButtonText?: string;
};

/**
 * ## Sticky Footer Ads
 *
 * Provides the javascript integration for sticky  footer ads, which consist of
 *
 * - close button feature
 * - removing HTML if the advertiser provides the entire ad creative
 * - removing HTML if ad is empty
 * - showing HTML if ad is none-empty
 *
 * @see https://highfivve.github.io/footer-ads/
 */
export class StickyFooterAdsV2 implements IModule {
  public readonly name: string = 'sticky-footer-ads-v2';
  public readonly description: string = 'sticky footer ad creatives';
  public readonly moduleType: ModuleType = 'creatives';

  constructor(private readonly stickyFooterAdConfig: StickyFooterAdConfig) {}

  config(): Object | null {
    return this.stickyFooterAdConfig;
  }

  init(
    config: Moli.MoliConfig,
    assetLoaderService: IAssetLoaderService,
    getAdPipeline: () => AdPipeline
  ): void {
    // direct prebid events
    // init additional pipeline steps if not already defined
    config.pipeline = config.pipeline || {
      initSteps: [],
      configureSteps: [],
      prepareRequestAdsSteps: []
    };

    config.pipeline.prepareRequestAdsSteps.push(
      mkPrepareRequestAdsStep(this.name, LOW_PRIORITY, (ctx, slots) => {
        // determine the slot to init sticky ad for
        const desktopSlot = slots.find(
          slot => slot.moliSlot.domId === this.stickyFooterAdConfig.stickyFooterDomIds.desktop
        );
        const mobileSlot = slots.find(
          slot => slot.moliSlot.domId === this.stickyFooterAdConfig.stickyFooterDomIds.mobile
        );
        // mobile traffic is usually a lot higher than desktop, so we opt for mobile as default if both are set.
        // this is usually a configuration error in the ad tag and should not happen
        const footerAdSlot = mobileSlot ? mobileSlot : desktopSlot;

        if (mobileSlot && desktopSlot) {
          ctx.logger.warn(this.name, 'mobile and desktop sticky footer are called!');
        }

        if (footerAdSlot) {
          initAdSticky(
            ctx.window,
            ctx.env,
            ctx.logger,
            footerAdSlot.moliSlot.domId,
            this.stickyFooterAdConfig.disallowedAdvertiserIds,
            this.stickyFooterAdConfig.closingButtonText
          );
        }

        return Promise.resolve();
      })
    );
  }
}
