/**
 * # [Pubstack](https://pubstack.io/)
 *
 * Pubstack is an Ad Analytics provider, which focuses on Prebid and Google AdExchange.
 *
 * ## Integration
 *
 * In your `index.ts` import pubstack and register the module.
 *
 * ```js
 * import { Pubstack } from '@highfivve/module-pubstack';
 * moli.registerModule(new Pubstack({
 *   tagId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
 * }, window));
 * ```
 *
 * ## Resources
 *
 * - [Documentation](https://pubstack.freshdesk.com/support/home)
 *
 * @module
 */
import {
  Moli,
  IModule,
  ModuleType,
  mkInitStep,
  AssetLoadMethod,
  IAssetLoaderService,
  mkConfigureStep
} from '@highfivve/ad-tag';

export type PubstackConfig = {
  /**
   * TagID from pubstack
   */
  readonly tagId: string;
};

/**
 * ## Pubstack Analytics
 *
 * Provides analytics for prebid, adx and hopefully more.
 *
 * @see https://pubstack.io
 */
export class Pubstack implements IModule {
  public readonly name: string = 'pubstack';
  public readonly description: string = 'prebid analytics integration';
  public readonly moduleType: ModuleType = 'reporting';

  constructor(private readonly pubstackConfig: PubstackConfig) {}

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
      mkInitStep('pubstack-init', context => {
        // load the pubstack script
        assetLoaderService
          .loadScript({
            name: 'pubstack',
            loadMethod: AssetLoadMethod.TAG,
            assetUrl: `https://boot.pbstck.com/v1/tag/${this.pubstackConfig.tagId}`
          })
          .catch(error => context.logger.error('failed to load pubstack', error));
        return Promise.resolve();
      })
    );

    config.pipeline.configureSteps.push(
      mkConfigureStep('pubstack-configure', ctx => {
        // these map to key-value values in the ad manager. All other values are not configured there and thus
        // don't need to be sent along
        const validABTestValues = ['0', '1', '2', '3'];
        // find meta data
        const meta = ctx.window.document.head.querySelector<HTMLMetaElement>(
          'meta[name="pbstck_context:pbstck_ab_test"]'
        );
        if (meta && meta.content && validABTestValues.includes(meta.content)) {
          ctx.window.googletag.pubads().setTargeting('pbstck_ab_test', meta.content);
        }

        return Promise.resolve();
      })
    );
  }
}
