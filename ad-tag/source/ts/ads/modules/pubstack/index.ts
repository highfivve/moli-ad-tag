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
import { IModule, ModuleType } from 'ad-tag/types/module';
import { AssetLoadMethod } from 'ad-tag/util/assetLoaderService';
import {
  ConfigureStep,
  InitStep,
  mkConfigureStep,
  mkInitStep,
  PrepareRequestAdsStep
} from '../../adPipeline';
import { modules } from 'ad-tag/types/moliConfig';
import { extractPubstackAbTestCohort } from './abTest';

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

  private pubstackConfig: modules.pubstack.PubstackConfig | null = null;

  config__(): Object | null {
    return this.pubstackConfig;
  }

  configure__(moduleConfig?: modules.ModulesConfig) {
    if (moduleConfig?.pubstack && moduleConfig.pubstack.enabled) {
      this.pubstackConfig = moduleConfig.pubstack;
    }
  }

  initSteps__(): InitStep[] {
    const config = this.pubstackConfig;
    return config
      ? [
          mkInitStep('pubstack-init', ctx => {
            if (ctx.env__ === 'test') {
              return Promise.resolve();
            }
            // load the pubstack script
            ctx.assetLoaderService__
              .loadScript({
                name: 'pubstack',
                loadMethod: AssetLoadMethod.TAG,
                assetUrl: `https://boot.pbstck.com/v1/tag/${config.tagId}`
              })
              .catch(error => ctx.logger__.error('failed to load pubstack', error));
            return Promise.resolve();
          })
        ]
      : [];
  }

  configureSteps__(): ConfigureStep[] {
    const config = this.pubstackConfig;
    return config
      ? [
          mkConfigureStep('pubstack-configure', ctx => {
            if (ctx.env__ === 'test') {
              return Promise.resolve();
            }
            const pubstackAbTestCohort = extractPubstackAbTestCohort(ctx);
            if (pubstackAbTestCohort) {
              ctx.window__.googletag.pubads().setTargeting('pbstck_ab_test', pubstackAbTestCohort);
            }

            return Promise.resolve();
          })
        ]
      : [];
  }

  prepareRequestAdsSteps__(): PrepareRequestAdsStep[] {
    return [];
  }
}
