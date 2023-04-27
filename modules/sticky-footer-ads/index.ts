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
 * import { StickyFooterAds } from '@highfivve/module-sticky-footer-ads';
 * moli.registerModule(new StickyFooterAds({
 *   mobileStickyDomId: 'ad-mobile-sticky',
 *   desktopFloorAdDomId: 'ad-floorad',
 *   disallowedAdvertiserIds: [ 111111, 222222 ]
 * }, window));
 * ```
 *
 * Next you need to add the required HTML and CSS on your page. See the [footer ads documentation](https://highfivve.github.io/footer-ads/)
 *
 * **Important**
 * The `data-ref`s are not configurable and are currently hardcoded. Make sure that they are correct.
 *
 * ## Resources
 *
 * - [Documentation](https://highfivve.github.io/footer-ads/)
 *
 * @module
 */
import { Moli, IModule, ModuleType, IAssetLoaderService } from '@highfivve/ad-tag';
import { mkConfigureStep } from 'ad-tag/lib';
import { setupFooterAdListener } from './desktopFloorAd';
import { initAdSticky } from './mobileSticky';

export type StickyFooterAdConfig = {
  /**
   */
  readonly mobileStickyDomId?: string;

  readonly desktopFloorAdDomId?: string;

  /**
   * Disable rendering the footer ad format for certain advertisers by specifying them here.
   * Most of the time you would use this for partners who ship their own special format or behaviour.
   *
   */
  readonly disallowedAdvertiserIds: number[];
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
export class StickyFooterAds implements IModule {
  public readonly name: string = 'sticky-footer-ads';
  public readonly description: string = 'sticky footer ad creatives';
  public readonly moduleType: ModuleType = 'creatives';

  constructor(private readonly stickyFooterAdConfig: StickyFooterAdConfig) {}

  config(): Object | null {
    return this.stickyFooterAdConfig;
  }

  init(config: Moli.MoliConfig, assetLoaderService: IAssetLoaderService): void {
    // direct prebid events
    // init additional pipeline steps if not already defined
    config.pipeline = config.pipeline || {
      initSteps: [],
      configureSteps: [],
      prepareRequestAdsSteps: []
    };

    config.pipeline.configureSteps.push(
      mkConfigureStep(this.name, ctx => {
        if (
          this.stickyFooterAdConfig.mobileStickyDomId &&
          ctx.config.slots.some(slot => slot.domId === this.stickyFooterAdConfig.mobileStickyDomId)
        ) {
          initAdSticky(
            ctx.window,
            ctx.env,
            ctx.logger,
            this.stickyFooterAdConfig.mobileStickyDomId,
            this.stickyFooterAdConfig.disallowedAdvertiserIds
          );
        }
        if (
          this.stickyFooterAdConfig.desktopFloorAdDomId &&
          ctx.config.slots.some(
            slot => slot.domId === this.stickyFooterAdConfig.desktopFloorAdDomId
          )
        ) {
          setupFooterAdListener(
            ctx.window,
            ctx.env,
            ctx.logger,
            this.stickyFooterAdConfig.desktopFloorAdDomId,
            this.stickyFooterAdConfig.disallowedAdvertiserIds
          );
        }
        return Promise.resolve();
      })
    );
  }
}
