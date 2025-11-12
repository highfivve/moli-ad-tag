import { IModule } from 'ad-tag/types/module';
import {
  AdPipelineContext,
  ConfigureStep,
  InitStep,
  mkInitStep,
  PrepareRequestAdsStep
} from 'ad-tag/ads/adPipeline';
import { modules } from 'ad-tag/types/moliConfig';
import { prebidjs } from 'ad-tag/types/prebidjs';

export const MoliAnalytics = (): IModule => {
  let moliAnalyticsConfig: modules.moliAnalytics.MoliAnalyticsConfig | null = null;

  const initMoliAnalytics = (context: AdPipelineContext): Promise<void> => {
    if (moliAnalyticsConfig === null) {
      return Promise.reject('moli-analytics not configured');
    }

    const genericAdapter: prebidjs.analytics.IGenericAnalyticsAdapter = {
      provider: 'generic',
      options: {
        url: moliAnalyticsConfig.url,
        batchSize: moliAnalyticsConfig.batchSize,
        events: {
          // TODO postindustria implement
          auctionEnd(request) {
            return {
              userId: context.runtimeConfig__.audience?.userId
            };
          },
          // TODO postindustria implement
          bidWon(response) {
            return {
              userId: context.runtimeConfig__.audience?.userId
            };
          }
        }
      }
    };
    context.window__.pbjs.enableAnalytics([genericAdapter]);
    return Promise.resolve();
  };

  return {
    name: 'moli-analytics',
    description: 'ad events tracking and analytics module',
    moduleType: 'reporting',
    config__(): modules.moliAnalytics.MoliAnalyticsConfig | null {
      return moliAnalyticsConfig;
    },
    configure__(moduleConfig?: modules.ModulesConfig): void {
      if (moduleConfig?.moliAnalytics?.enabled) {
        moliAnalyticsConfig = moduleConfig.moliAnalytics;
      }
    },
    configureSteps__(): ConfigureStep[] {
      return [];
    },
    initSteps__(): InitStep[] {
      return [
        mkInitStep('moli-analytics-init', (context: AdPipelineContext) =>
          initMoliAnalytics(context)
        )
      ];
    },
    prepareRequestAdsSteps__(): PrepareRequestAdsStep[] {
      return [];
    }
  };
};
