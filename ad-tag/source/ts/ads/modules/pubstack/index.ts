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
            if (ctx.env === 'test') {
              return Promise.resolve();
            }
            // load the pubstack script
            ctx.assetLoaderService
              .loadScript({
                name: 'pubstack',
                loadMethod: AssetLoadMethod.TAG,
                assetUrl: `https://boot.pbstck.com/v1/tag/${config.tagId}`
              })
              .catch(error => ctx.logger.error('failed to load pubstack', error));
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
            if (ctx.env === 'test') {
              return Promise.resolve();
            }
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
        ]
      : [];
  }

  prepareRequestAdsSteps__(): PrepareRequestAdsStep[] {
    return [];
  }
}
