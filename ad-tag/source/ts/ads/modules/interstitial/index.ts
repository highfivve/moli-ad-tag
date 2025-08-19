import { IModule, ModuleType } from 'ad-tag/types/module';
import {
  ConfigureStep,
  InitStep,
  LOW_PRIORITY,
  mkPrepareRequestAdsStep,
  PrepareRequestAdsStep
} from 'ad-tag/ads/adPipeline';
import { modules } from 'ad-tag/types/moliConfig';
import { initInterstitialModule } from 'ad-tag/ads/modules/interstitial/interstitialAd';

/**
 * # Interstitial Module
 *
 * Uses the highfivve custom interstitial creative unless the bidder delivers his own creative.
 *
 * ## Integration
 *
 * Module has to be registered and the corresponding styles need to be added to the page.
 * This can e.g. be done by adding the ad tag stylesheet with the source https://cdn.h5v.eu/publishers/{publisherCode}/assets/production/styles.css.
 *
 * @module
 */
export class InterstitialModule implements IModule {
  public readonly name: string = 'interstitial-module';
  public readonly description: string = 'interstitial ad creatives';
  public readonly moduleType: ModuleType = 'creatives';

  private interstitialModuleConfig: modules.interstitial.InterstitialModuleConfig | null = null;

  config__(): Object | null {
    return this.interstitialModuleConfig;
  }

  configure__(moduleConfig?: modules.ModulesConfig | undefined): void {
    if (moduleConfig?.interstitial && moduleConfig.interstitial.enabled) {
      this.interstitialModuleConfig = moduleConfig.interstitial;
    }
  }

  prepareRequestAdsSteps__(): PrepareRequestAdsStep[] {
    const config = this.interstitialModuleConfig;
    return config
      ? [
          mkPrepareRequestAdsStep(this.name, LOW_PRIORITY, (ctx, slots) => {
            const interstitialSlot = slots.find(
              slot => slot.moliSlot.domId === config.interstitialDomId
            );

            if (interstitialSlot) {
              initInterstitialModule(
                ctx.window__,
                ctx.env__,
                ctx.logger__,
                interstitialSlot.moliSlot.domId,
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
