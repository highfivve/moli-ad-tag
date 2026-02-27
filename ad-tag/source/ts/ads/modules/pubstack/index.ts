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
export const createPubstack = (): IModule => {
  const name = 'pubstack';
  let pubstackConfig: modules.pubstack.PubstackConfig | null = null;

  const config__ = (): Object | null => pubstackConfig;

  const configure__ = (moduleConfig?: modules.ModulesConfig) => {
    if (moduleConfig?.pubstack && moduleConfig.pubstack.enabled) {
      pubstackConfig = moduleConfig.pubstack;
    }
  };

  const initSteps__ = (): InitStep[] => {
    const config = pubstackConfig;
    return config
      ? [
          mkInitStep('pubstack-init', ctx => {
            if (ctx.env__ === 'test') {
              return Promise.resolve();
            }
            // load the pubstack script
            ctx.assetLoaderService__
              .loadScript({
                name,
                loadMethod: AssetLoadMethod.TAG,
                assetUrl: `https://boot.pbstck.com/v1/tag/${config.tagId}`
              })
              .catch(error => ctx.logger__.error('failed to load pubstack', error));
            return Promise.resolve();
          })
        ]
      : [];
  };

  const configureSteps__ = (): ConfigureStep[] => {
    const config = pubstackConfig;
    return config
      ? [
          mkConfigureStep('pubstack-configure', ctx => {
            if (ctx.env__ === 'test') {
              return Promise.resolve();
            }
            // these map to key-value values in the ad manager. All other values are not configured there and thus
            // don't need to be sent along
            const validABTestValues = ['0', '1', '2', '3'];
            // find meta data
            const meta = ctx.window__.document.head.querySelector<HTMLMetaElement>(
              'meta[name="pbstck_context:pbstck_ab_test"]'
            );
            if (meta && meta.content && validABTestValues.includes(meta.content)) {
              ctx.window__.googletag.pubads().setTargeting('pbstck_ab_test', meta.content);
            }

            return Promise.resolve();
          })
        ]
      : [];
  };

  const prepareRequestAdsSteps__ = (): PrepareRequestAdsStep[] => [];

  return {
    name,
    description: 'prebid analytics integration',
    moduleType: 'reporting' as ModuleType,
    config__,
    configure__,
    initSteps__,
    configureSteps__,
    prepareRequestAdsSteps__
  };
};