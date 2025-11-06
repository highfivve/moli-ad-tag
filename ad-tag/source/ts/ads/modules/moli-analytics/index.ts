import { IModule, ModuleType } from 'ad-tag/types/module';
import {
  AdPipelineContext,
  ConfigureStep,
  InitStep,
  mkInitStep,
  PrepareRequestAdsStep,
  RequestBidsStep
} from 'ad-tag/ads/adPipeline';
import { modules } from 'ad-tag/types/moliConfig';
import { prebidjs } from 'ad-tag/types/prebidjs';

export class MoliAnalytics implements IModule {
  readonly name: string = 'moli-analytics';
  readonly description: string = 'ad events tracking and analytics module';
  readonly moduleType: ModuleType = 'reporting';

  private moliAnalyticsConfig: modules.moliAnalytics.MoliAnalyticsConfig | null = null;

  config__(): modules.moliAnalytics.MoliAnalyticsConfig | null {
    return this.moliAnalyticsConfig;
  }

  configure__(moduleConfig?: modules.ModulesConfig): void {
    if (moduleConfig?.moliAnalytics?.enabled) {
      this.moliAnalyticsConfig = moduleConfig.moliAnalytics;
    }
  }

  configureSteps__(): ConfigureStep[] {
    return [];
  }

  private initMoliAnalytics(context: AdPipelineContext): Promise<void> {
    if (this.moliAnalyticsConfig === null) {
      return Promise.reject('moli-analytics not configured');
    }

    const genericAdapter: prebidjs.analytics.IGenericAnalyticsAdapter = {
      provider: 'generic',
      options: {
        url: this.moliAnalyticsConfig.url,
        batchSize: this.moliAnalyticsConfig.batchSize,
        events: {
          bidRequested(request) {
            return {
              type: 'REQUEST',
              auctionId: request.auctionId,
              bidder: request.bidderCode
            };
          },
          bidResponse(response) {
            return {
              type: 'RESPONSE',
              auctionId: response.auctionId,
              bidder: response.bidderCode
            };
          }
        }
      }
    };
    context.window__.pbjs.enableAnalytics([genericAdapter]);
    return Promise.resolve();
  }

  initSteps__(): InitStep[] {
    return [
      mkInitStep('moli-analytics-init', (context: AdPipelineContext) =>
        this.initMoliAnalytics(context)
      )
    ];
  }

  prepareRequestAdsSteps__(): PrepareRequestAdsStep[] {
    return [];
  }
}
