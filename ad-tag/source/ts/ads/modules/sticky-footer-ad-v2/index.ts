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
 * moli.registerModule(new NewStickyFooterAds());
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
import { IModule, ModuleType } from 'ad-tag/types/module';
import {
  ConfigureStep,
  InitStep,
  LOW_PRIORITY,
  mkPrepareRequestAdsStep,
  PrepareRequestAdsStep
} from 'ad-tag/ads/adPipeline';
import { modules } from 'ad-tag/types/moliConfig';

import { initAdSticky } from './footerStickyAd';

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

  private stickyFooterAdConfig: modules.stickyFooterAdV2.StickyFooterAdConfig | null = null;

  config(): Object | null {
    return this.stickyFooterAdConfig;
  }

  configure(moduleConfig?: modules.ModulesConfig | undefined): void {
    if (moduleConfig?.stickyFooterAdV2 && moduleConfig.stickyFooterAdV2.enabled) {
      this.stickyFooterAdConfig = moduleConfig.stickyFooterAdV2;
    }
  }

  prepareRequestAdsSteps(): PrepareRequestAdsStep[] {
    const config = this.stickyFooterAdConfig;
    return config
      ? [
          mkPrepareRequestAdsStep(this.name, LOW_PRIORITY, (ctx, slots) => {
            // determine the slot to init sticky ad for
            const desktopSlot = slots.find(
              slot => slot.moliSlot.domId === config.stickyFooterDomIds.desktop
            );
            const mobileSlot = slots.find(
              slot => slot.moliSlot.domId === config.stickyFooterDomIds.mobile
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
                config.disallowedAdvertiserIds,
                config.closingButtonText
              );
            }
            return Promise.resolve();
          })
        ]
      : [];
  }

  configureSteps(): ConfigureStep[] {
    return [];
  }
  initSteps(): InitStep[] {
    return [];
  }
}
