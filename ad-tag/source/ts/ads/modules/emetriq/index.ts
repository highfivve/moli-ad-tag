/**
 * # Emetriq data collection module ([-> Docs](https://doc.emetriq.de/#/profiling/adp/data-providers-client)
 *
 * This module provides Emetriq data collection functionality to Moli.
 *
 * ## Integration Web
 *
 * In your `index.ts`, import Emetriq and register the module.
 *
 * ```js
 * import { createEmetriq } from '@highfivve/module-emetriq';
 *
 * moli.registerModule(createEmetriq());
 * ```
 *
 * @module
 */

import { AssetLoadMethod } from 'ad-tag/util/assetLoaderService';
import {
  EmetriqAdditionalIdentifier,
  EmetriqWindow,
  EmetriqCustomParams
} from 'ad-tag/types/emetriq';
import { trackInApp } from './trackInApp';
import { googleAdManager, modules } from 'ad-tag/types/moliConfig';
import { shouldTrackLoginEvent, trackLoginEvent } from './trackLoginEvent';
import { ModuleType, IModule } from 'ad-tag/types/module';
import {
  AdPipelineContext,
  InitStep,
  ConfigureStep,
  mkConfigureStepOncePerRequestAdsCycle,
  PrepareRequestAdsStep,
  mkInitStep
} from 'ad-tag/ads/adPipeline';

/* from https://github.com/piotrwitek/utility-types */
type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

export interface IEmetriqModule extends IModule {
  loadEmetriqScript(
    context: AdPipelineContext,
    webConfig: modules.emetriq.EmetriqWebConfig,
    additionalIdentifier: EmetriqAdditionalIdentifier,
    additionalCustomParams: EmetriqCustomParams
  ): Promise<void>;
  checkIfConsentIsMissing(ctx: AdPipelineContext): boolean;
}

/**
 * This method assumes that `window.pbjs` is available and loaded. Call this only inside of
 * a `window.pbjs.que(() => ...)` callback.
 *
 * @param ctx ad pipeline context to access `pbjs`
 */
export const prebidIdentifiers = (ctx: AdPipelineContext): EmetriqAdditionalIdentifier => {
  const identifier: Mutable<EmetriqAdditionalIdentifier> = {};
  const userIds = ctx.window__.pbjs.getUserIds();
  if (userIds.amxId) {
    identifier.id_amxid = userIds.amxId;
  }
  if (userIds.idl_env) {
    identifier.id_liveramp = userIds.idl_env;
  }
  if (userIds.IDP) {
    identifier.id_zeotap = userIds.IDP;
  }
  if (userIds.pubcid) {
    identifier.id_sharedid = userIds.pubcid;
  }
  if (userIds.id5id) {
    identifier.id_id5 = userIds.id5id.uid;
  }
  return identifier;
};

/**
 * Returns a promise that delays the data tracking call.
 *
 * @param ctx ad pipeline context for `window` access
 * @param delay configuration of delay
 */
export const syncDelay = (
  ctx: AdPipelineContext,
  delay?: modules.emetriq.SyncDelay
): Promise<EmetriqAdditionalIdentifier> => {
  if (delay) {
    if (typeof delay === 'number') {
      return new Promise(resolve => ctx.window__.setTimeout(() => resolve({}), delay));
    } else {
      if (ctx.window__.pbjs) {
        return new Promise(resolve => {
          ctx.window__.pbjs.que.push(() => {
            const listener = () => {
              resolve(prebidIdentifiers(ctx));
              ctx.window__.pbjs.offEvent('auctionEnd', listener);
            };
            ctx.window__.pbjs.onEvent('auctionEnd', listener);
          });
        });
      } else {
        ctx.logger__.error('emetriq', 'No sync delay, because window.pbjs is not defined!');
        return Promise.resolve({});
      }
    }
  }
  // default is no delay
  return Promise.resolve({});
};

export const staticCustomParams = (
  targeting: googleAdManager.KeyValueMap,
  mappings: modules.emetriq.EmetriqMappingDefinition[] | undefined
): EmetriqCustomParams => {
  let additionalCustomParams: Mutable<EmetriqCustomParams> = {};
  (mappings ?? []).forEach(({ param, key }) => {
    const value = targeting[key];
    if (value) {
      additionalCustomParams[param] = typeof value === 'string' ? value : value.join(',');
    }
  });
  return additionalCustomParams;
};

/**
 * Namespace for backward compatibility. Provides static utility methods as object properties,
 * allowing sinon to spy/stub them (e.g. `sandbox.spy(Emetriq, 'syncDelay')`).
 */
export const Emetriq = { syncDelay, staticCustomParams, prebidIdentifiers };

/**
 * # Emetriq Module
 *
 * This module provides Emetriq data collection functionality to Moli.
 *
 * @see https://doc.emetriq.de/#/profiling/adp/data-providers-client
 */
export const createEmetriq = (): IEmetriqModule => {
  const name = 'emetriq';
  const gvlid: string = '213';
  let emetriqConfig: modules.emetriq.EmetriqModuleConfig | null = null;

  const config__ = (): modules.emetriq.EmetriqModuleConfig | null => emetriqConfig;

  const configure__ = (moduleConfig?: modules.ModulesConfig): void => {
    if (moduleConfig?.emetriq && moduleConfig.emetriq.enabled) {
      emetriqConfig = moduleConfig.emetriq;
    }
  };

  const checkIfConsentIsMissing = (ctx: AdPipelineContext): boolean => {
    if (ctx.tcData__.gdprApplies && !ctx.tcData__.vendor.consents[gvlid]) {
      ctx.logger__.warn(name, 'missing consent');
      return true;
    }
    return false;
  };

  const loadEmetriqScript = (
    context: AdPipelineContext,
    webConfig: modules.emetriq.EmetriqWebConfig,
    additionalIdentifier: EmetriqAdditionalIdentifier,
    additionalCustomParams: EmetriqCustomParams
  ): Promise<void> => {
    const window = context.window__ as EmetriqWindow;
    window._enqAdpParam = {
      ...webConfig._enqAdpParam,
      ...additionalIdentifier,
      ...additionalCustomParams
    };

    return context.assetLoaderService__
      .loadScript({
        name,
        loadMethod: AssetLoadMethod.TAG,
        assetUrl: `https://ups.xplosion.de/loader/${webConfig._enqAdpParam.sid}/default.js`
      })
      .catch(error => context.logger__.error('failed to load emetriq', error));
  };

  const initSteps__ = (): InitStep[] => {
    const config = emetriqConfig;
    return config
      ? [
          mkInitStep('load-emetriq', ctx => {
            const customParams = Emetriq.staticCustomParams(
              { ...ctx.config__.targeting?.keyValues, ...ctx.runtimeConfig__.keyValues },
              config.customMappingDefinition
            );

            // test environment doesn't require emetriq
            if (ctx.env__ === 'test') {
              return Promise.resolve();
            }

            // no consent
            if (checkIfConsentIsMissing(ctx)) {
              return Promise.resolve();
            }

            Emetriq.syncDelay(ctx, config.syncDelay).then(additionalIdentifier => {
              switch (config.os) {
                case 'web':
                  loadEmetriqScript(ctx, config, additionalIdentifier, customParams);
                  break;
              }
            });
            return Promise.resolve();
          })
        ]
      : [];
  };

  const configureSteps__ = (): ConfigureStep[] => {
    const config = emetriqConfig;
    return config
      ? [
          mkConfigureStepOncePerRequestAdsCycle('track-emetriq', ctx => {
            const customParams = Emetriq.staticCustomParams(
              { ...ctx.config__.targeting?.keyValues, ...ctx.runtimeConfig__.keyValues },
              config.customMappingDefinition
            );
            // test environment doesn't require emetriq
            if (ctx.env__ === 'test') {
              return Promise.resolve();
            }

            // no consent
            if (checkIfConsentIsMissing(ctx)) {
              return Promise.resolve();
            }

            if (
              config.login &&
              shouldTrackLoginEvent(ctx.window__.sessionStorage, Date.now(), ctx.logger__)
            ) {
              trackLoginEvent(ctx, config, ctx.window__.document, ctx.logger__);
            }

            Emetriq.syncDelay(ctx, config.syncDelay).then(additionalIdentifier => {
              switch (config.os) {
                case 'android':
                case 'ios':
                  trackInApp(
                    ctx,
                    config,
                    additionalIdentifier,
                    customParams,
                    ctx.window__.document
                  );
                  break;
              }
            });

            return Promise.resolve();
          })
        ]
      : [];
  };

  const prepareRequestAdsSteps__ = (): PrepareRequestAdsStep[] => [];

  return {
    name,
    description: 'Provides Emetriq data collection functionality to Moli.',
    moduleType: 'dmp' as ModuleType,
    config__,
    configure__,
    initSteps__,
    configureSteps__,
    prepareRequestAdsSteps__,
    checkIfConsentIsMissing,
    loadEmetriqScript
  };
};
