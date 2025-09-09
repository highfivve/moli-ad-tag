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
 * import { Emetriq } from '@highfivve/module-emetriq';
 *
 * moli.registerModule(
 *   new Emetriq({
 *     os: 'web',
 *     syncDelay: 'pbjs', // wait for the first auction to end before the sync is triggered
 *     _enqAdpParam: {
 *       sid: 1337,
 *       yob: '2001',
 *       custom1: 'IAB1,IAB1-2',
 *       id_sharedid: '7338305e-6779-4239-9d3b-897730521992'
 *     }
 *   })
 * );
 * ```
 *
 * Configure the module with:
 *
 * - your Emetriq `sid`
 * - additional fields such as
 *   - yob, zip or gender
 *   - custom1, custom2, custom3, ...
 *   - id_id5, id_liveramp, ...
 *
 * ## Integration App
 *
 * If you load emetriq in a Webview in an app you can send tracking information as well.
 *
 * In your `index.ts`, import Emetriq and register the module.
 *
 * ```js
 * import { Emetriq } from '@highfivve/module-emetriq';
 *
 * moli.registerModule(
 *   new Emetriq({
 *     os: 'android' // or 'ios',
 *     syncDelay: 2000, // wait 2000ms before syncing
 *     sid: 123,
 *
 *     // AppID in the app store
 *     appId: 'com.highfivve.app',
 *
 *     // describes the key-value where the IDFA or AdID is located
 *     advertiserIdKey: 'advertiserId',
 *     // provider at least one property `link` or `keywords`
 *     linkOrKeyword: {
 *       keywords: 'sports,football'
 *     },
 *
 *     // optionally provide more identifiers
 *     additionalIdentifier: {
 *       id_sharedid: '1c6e063f-feaa-40a0-8a86-b9be3c655c39'
 *     }
 *   })
 * );
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

/**
 * ## Link
 * Optional if keywords param is present, otherwise mandatory.
 * Analog to web URL (URL encoded). Absolute and relative urls are supported. Absolute path should start with http, https or //. Examples of absolute paths:
 *
 * - `http://www.example.com/some-path/2` (`http%3A%2F%2Fwww.example.com%2Fsome-path%2F2` - URL encoded version)
 * - `http://www.example.com/some-path/2` (`http%3A%2F%2Fwww.example.com%2Fsome-path%2F2` - URL encoded version)
 * - `//www.example.com/some-path/2` ( `%2F%2Fwww.example.com%2Fsome-path%2F2` - URL encoded version) Relative path should start with `/`.
 *
 * Examples of relative paths:
 *
 * - `/some-path/2` ( `%2Fsome-path%2F2` - URL encoded version)
 * @example http://www.example.com/some-path/2
 *
 * ## Keywords
 *
 * Comma separated list of keywords. URL encoded.
 *
 * Optional if `link` param is present, otherwise mandatory. Comma separated content related keywords (URL encoded).
 *
 * @example `sport,hsv,fussball`
 */

/**
 * @see https://docs.xdn.emetriq.de/#event-import
 */

/**
 * # Emetriq Module
 *
 * This module provides Emetriq data collection functionality to Moli.
 *
 * @see https://doc.emetriq.de/#/profiling/adp/data-providers-client
 */
export class Emetriq implements IModule {
  public readonly name: string = 'emetriq';
  public readonly description: string = 'Provides Emetriq data collection functionality to Moli.';
  public readonly moduleType: ModuleType = 'dmp';

  private readonly gvlid: string = '213';

  private emetriqConfig: modules.emetriq.EmetriqModuleConfig | null = null;

  config__(): modules.emetriq.EmetriqModuleConfig | null {
    return this.emetriqConfig;
  }

  configure__(moduleConfig?: modules.ModulesConfig): void {
    if (moduleConfig?.emetriq && moduleConfig.emetriq.enabled) {
      this.emetriqConfig = moduleConfig.emetriq;
    }
  }

  initSteps__(): InitStep[] {
    const config = this.emetriqConfig;
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
            if (this.checkIfConsentIsMissing(ctx)) {
              return Promise.resolve();
            }

            Emetriq.syncDelay(ctx, config.syncDelay).then(additionalIdentifier => {
              switch (config.os) {
                case 'web':
                  this.loadEmetriqScript(ctx, config, additionalIdentifier, customParams);
                  break;
              }
            });
            return Promise.resolve();
          })
        ]
      : [];
  }

  configureSteps__(): ConfigureStep[] {
    const config = this.emetriqConfig;
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
            if (this.checkIfConsentIsMissing(ctx)) {
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
  }

  prepareRequestAdsSteps__(): PrepareRequestAdsStep[] {
    return [];
  }

  checkIfConsentIsMissing(ctx: AdPipelineContext): boolean {
    if (ctx.tcData__.gdprApplies && !ctx.tcData__.vendor.consents[this.gvlid]) {
      ctx.logger__.warn(this.name, 'missing consent');
      return true;
    }
    return false;
  }

  loadEmetriqScript(
    context: AdPipelineContext,
    webConfig: modules.emetriq.EmetriqWebConfig,
    additionalIdentifier: EmetriqAdditionalIdentifier,
    additionalCustomParams: EmetriqCustomParams
  ): Promise<void> {
    const window = context.window__ as EmetriqWindow;
    window._enqAdpParam = {
      ...webConfig._enqAdpParam,
      ...additionalIdentifier,
      ...additionalCustomParams
    };

    return context.assetLoaderService__
      .loadScript({
        name: this.name,
        loadMethod: AssetLoadMethod.TAG,
        assetUrl: `https://ups.xplosion.de/loader/${webConfig._enqAdpParam.sid}/default.js`
      })
      .catch(error => context.logger__.error('failed to load emetriq', error));
  }

  /**
   * Returns a promise that delays the data tracking call.
   *
   * @param ctx ad pipeline context for `window` access
   * @param delay configuration of delay
   */
  static syncDelay(
    ctx: AdPipelineContext,
    delay?: modules.emetriq.SyncDelay
  ): Promise<EmetriqAdditionalIdentifier> {
    if (delay) {
      if (typeof delay === 'number') {
        return new Promise(resolve => ctx.window__.setTimeout(() => resolve({}), delay));
      } else {
        if (ctx.window__.pbjs) {
          return new Promise(resolve => {
            ctx.window__.pbjs.que.push(() => {
              const listener = () => {
                resolve(Emetriq.prebidIdentifiers(ctx));
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
  }

  static staticCustomParams(
    targeting: googleAdManager.KeyValueMap,
    mappings: modules.emetriq.EmetriqMappingDefinition[] | undefined
  ): EmetriqCustomParams {
    let additionalCustomParams: Mutable<EmetriqCustomParams> = {};
    (mappings ?? []).forEach(({ param, key }) => {
      const value = targeting[key];
      if (value) {
        additionalCustomParams[param] = typeof value === 'string' ? value : value.join(',');
      }
    });
    return additionalCustomParams;
  }

  /**
   * This method assumes that `window.pbjs` is available and loaded. Call this only inside of
   * a `window.pbjs.que(() => ...)` callback.
   *
   * @param ctx ad pipeline context to access `pbjs`
   */
  static prebidIdentifiers(ctx: AdPipelineContext): EmetriqAdditionalIdentifier {
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
  }
}
