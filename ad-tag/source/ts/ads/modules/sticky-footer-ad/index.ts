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
import { IModule, ModuleType } from 'ad-tag/types/module';
import {
  ConfigureStep,
  InitStep,
  LOW_PRIORITY,
  mkPrepareRequestAdsStep,
  PrepareRequestAdsStep
} from 'ad-tag/ads/adPipeline';
import { modules } from 'ad-tag/types/moliConfig';
import { setupFooterAdListener } from './desktopFloorAd';
import { initMobileAdSticky } from './mobileSticky';

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
export class StickyFooterAd implements IModule {
  public readonly name: string = 'sticky-footer-ads';
  public readonly description: string = 'sticky footer ad creatives';
  public readonly moduleType: ModuleType = 'creatives';

  private stickyFooterAdConfig: modules.stickyFooterAd.StickyFooterAdConfig | null = null;

  config__(): Object | null {
    return this.stickyFooterAdConfig;
  }

  configure__(moduleConfig?: modules.ModulesConfig | undefined): void {
    if (moduleConfig?.stickyFooterAd?.enabled) {
      this.stickyFooterAdConfig = moduleConfig.stickyFooterAd;
    }
  }

  prepareRequestAdsSteps__(): PrepareRequestAdsStep[] {
    const config = this.stickyFooterAdConfig;
    return config
      ? [
          mkPrepareRequestAdsStep(this.name, LOW_PRIORITY, (ctx, slots) => {
            if (
              config.mobileStickyDomId &&
              slots.some(
                slot => slot.moliSlot.domId === this.stickyFooterAdConfig?.mobileStickyDomId
              )
            ) {
              initMobileAdSticky(
                ctx.window,
                ctx.env,
                ctx.logger,
                config.mobileStickyDomId,
                config.disallowedAdvertiserIds,
                config.initiallyHidden ?? false
              );
            }
            if (
              config.desktopFloorAdDomId &&
              slots.some(slot => slot.moliSlot.domId === config.desktopFloorAdDomId)
            ) {
              setupFooterAdListener(
                ctx.window,
                ctx.env,
                ctx.logger,
                config.desktopFloorAdDomId,
                config.disallowedAdvertiserIds
              );
            }
            return Promise.resolve();
          })
        ]
      : [];
  }

  configureSteps__(): ConfigureStep[] {
    return [];
  }

  initSteps__(): InitStep[] {
    return [];
  }
}
