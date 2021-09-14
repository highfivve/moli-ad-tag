import {
  AdPipeline,
  AdPipelineContext,
  IAssetLoaderService,
  IModule,
  mkConfigureStep,
  ModuleType,
  Moli
} from '@highfivve/ad-tag';
import { prebidConfigure } from '@highfivve/ad-tag/lib/ads/prebid';
import { prebidjs } from '@highfivve/ad-tag/lib/types/prebidjs';

type PrebidFirstPartyDataModuleConfig = {
  firstPartyData: prebidjs.firstpartydata.PrebidFirstPartyData;
};

export class PrebidFirstPartyDataModule implements IModule {
  readonly description = 'Module for passing first party data to prebid auctions';
  readonly moduleType: ModuleType = 'prebid';
  readonly name = 'prebid-first-party-data';

  constructor(private readonly moduleConfig: PrebidFirstPartyDataModuleConfig) {}

  config(): PrebidFirstPartyDataModuleConfig {
    return this.moduleConfig;
  }

  init(
    moliConfig: Moli.MoliConfig,
    assetLoaderService: IAssetLoaderService,
    getAdPipeline: () => AdPipeline
  ): void {
    const { firstPartyData } = this.config();

    // init additional pipeline steps if not already defined
    moliConfig.pipeline = moliConfig.pipeline || {
      initSteps: [],
      configureSteps: [],
      prepareRequestAdsSteps: []
    };

    // FIXME this is probably bullshit because it doesn't depend on the moli global API
    moliConfig.pipeline.configureSteps.push(
      mkConfigureStep('Prebid FPD module setup', context =>
        PrebidFirstPartyDataModule.setPrebidFpdConfig(context, firstPartyData)
      )
    );
  }

  private static setPrebidFpdConfig(
    context: AdPipelineContext,
    prebidFpd: prebidjs.firstpartydata.PrebidFirstPartyData
  ): Promise<void> {
    if (context.config.prebid) {
      return prebidConfigure({
        ...context.config.prebid,
        config: { ...context.config.prebid.config, ortb2: prebidFpd }
      })(context, []);
    }

    return Promise.resolve();
  }
}
