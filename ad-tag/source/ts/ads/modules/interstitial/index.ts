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
export const createInterstitialModule = (): IModule => {
  let interstitialModuleConfig: modules.interstitial.InterstitialModuleConfig | null = null;

  return {
    name: 'interstitial-module',
    description: 'interstitial ad creatives',
    moduleType: 'creatives' as ModuleType,
    config__(): Object | null {
      return interstitialModuleConfig;
    },
    configure__(moduleConfig?: modules.ModulesConfig | undefined): void {
      if (moduleConfig?.interstitial && moduleConfig.interstitial.enabled) {
        interstitialModuleConfig = moduleConfig.interstitial;
      }
    },
    prepareRequestAdsSteps__(): PrepareRequestAdsStep[] {
      const config = interstitialModuleConfig;
      return config
        ? [
            mkPrepareRequestAdsStep('interstitial-module', LOW_PRIORITY, (ctx, slots) => {
              const interstitialSlot = slots.find(
                slot => slot.moliSlot.domId === config.interstitialDomId
              );
              if (interstitialSlot) {
                initInterstitialModule(
                  ctx.window__,
                  ctx.env__,
                  ctx.logger__,
                  interstitialSlot.moliSlot.domId,
                  config.disallowedAdvertiserIds,
                  config.closeAutomaticallyAfterMs
                );
              }
              return Promise.resolve();
            })
          ]
        : [];
    },
    configureSteps__(): ConfigureStep[] {
      return [];
    },
    initSteps__(): InitStep[] {
      return [];
    }
  };
};
