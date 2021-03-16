import {
  Moli,
  IModule,
  ModuleType,
  mkInitStep,
  AssetLoadMethod,
  IAssetLoaderService
} from '@highfivve/ad-tag';

export interface IPubstackConfig {
  readonly tagId: string;
}

/**
 * == Pubstack Analytics ==
 *
 * Provides analytics for prebid, adx and hopefully more.
 *
 * @see https://pubstack.io
 */
export default class Pubstack implements IModule {
  public readonly name: string = 'pubstack';
  public readonly description: string = 'prebid analytics integration';
  public readonly moduleType: ModuleType = 'reporting';

  constructor(private readonly pubstackConfig: IPubstackConfig) {}

  config(): Object | null {
    return this.pubstackConfig;
  }

  init(config: Moli.MoliConfig, assetLoaderService: IAssetLoaderService): void {
    // direct prebid events
    // init additional pipeline steps if not already defined
    config.pipeline = config.pipeline || {
      initSteps: [],
      configureSteps: [],
      prepareRequestAdsSteps: []
    };

    config.pipeline.initSteps.push(
      mkInitStep('pubstack', ctx => {
        // load the pubstack script
        assetLoaderService.loadScript({
          name: 'pubstack',
          loadMethod: AssetLoadMethod.TAG,
          assetUrl: `https://boot.pbstck.com/v1/tag/${this.pubstackConfig.tagId}`
        });
        return Promise.resolve();
      })
    );
  }
}
