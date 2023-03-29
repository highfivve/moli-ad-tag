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
 * If you emetriq in a Webview in an app you can send tracking information as well.
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
import {
  AdPipelineContext,
  AssetLoadMethod,
  IAssetLoaderService,
  IModule,
  mkInitStep,
  ModuleType,
  Moli
} from '@highfivve/ad-tag';
import { EmetriqAdditionalIdentifier, EmetriqParams, EmetriqWindow } from './types/emetriq';
import { trackInApp } from './trackInApp';

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
export type EmetriqAppKeywordOrLinkConfig =
  | {
      /** @see EmetriqAppKeywordOrLinkConfig docs */
      readonly link: string;
      /** @see EmetriqAppKeywordOrLinkConfig docs */
      readonly keywords: string;
    }
  | {
      /** @see EmetriqAppKeywordOrLinkConfig docs */
      readonly link: string;
      readonly keywords?: undefined;
    }
  | {
      readonly link?: undefined;
      /** @see EmetriqAppKeywordOrLinkConfig docs */
      readonly keywords: string;
    };

type SyncDelay = number | 'pbjs';

/* from https://github.com/piotrwitek/utility-types */
type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

export type EmetriqMappingDefinition = {
  /**
   * custom parameter provided to emetriq
   */
  readonly param: `custom${number}`;

  /**
   * key matching a key-value in the targeting object, that contains the param
   * value for emetriq.
   *
   * string arrays will be mapped to a single, comma separated string.
   *
   * If a key is not available in the targeting map, it will be ommited.
   */
  readonly key: string;
};

/**
 * Shared configuration properties for emetriq module config.
 */
export interface IEmetriqModuleConfig {
  /**
   * Defines a delay for the user-sync
   *
   * - `pbjs` (recommened)
   *    uses the prebid.js `auctionEnd` event to fire the user sync.
   * - `number`
   *    delay in `ms` before the script is loaded. Use this if prebid is not
   *    available
   *
   * @default if not set, there is no delay
   */
  readonly syncDelay?: SyncDelay;

  /**
   * Optional mapping definitions. Map values from the key-value targeting map
   * to a custom parameter that is sent to emetriq.
   */
  readonly customMappingDefinition?: EmetriqMappingDefinition[];
}

/**
 * InApp tracking configuration
 *
 * @see https://doc.emetriq.de/inapp/api.html#get-/data
 */
export interface EmetriqAppConfig extends IEmetriqModuleConfig {
  /**
   * inApp configuration
   * Required parameter for app tracking
   */
  readonly os: 'android' | 'ios';

  readonly sid: number;

  /**
   * App id of app store
   * @example `de.emetriq.exampleApp`
   */
  readonly appId: string;

  /**
   * At least one of the config properties `link` or `keywords` must be set.
   */
  readonly linkOrKeyword: EmetriqAppKeywordOrLinkConfig;

  /**
   * Key within the moli config keyValues in which the advertising id can be found.
   *
   * Used to infer the `device_id` parameter.
   * > `device_id`: Optional. Mobile identifier (IDFA or ADID). In lower case.
   * > This field can be omitted if it is not possible to obtain the identifier.
   */
  readonly advertiserIdKey: string;

  /**
   * Configure additional identifiers
   *
   * @see https://doc.emetriq.de/#/profiling/identifiers
   */
  readonly additionalIdentifier?: EmetriqAdditionalIdentifier;

  /**
   * Additional parameters (i.e. hardfacts), which could be provided from a partner. (i.e. `gender=frau&age=25`)
   *
   * @see https://doc.emetriq.de/#/inapp/integration
   */
  readonly customKeywords?: EmetriqParams;
}

export interface EmetriqWebConfig extends IEmetriqModuleConfig {
  /**
   * specifies that the emetriq js should be loaded
   */
  readonly os: 'web';

  /**
   * Global parameter on window
   */
  readonly _enqAdpParam: EmetriqParams;
}

export type EmetriqModuleConfig = EmetriqAppConfig | EmetriqWebConfig;

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

  private readonly window: EmetriqWindow;

  private readonly gvlid: string = '213';

  constructor(private readonly moduleConfig: EmetriqModuleConfig, window: Window) {
    this.window = window as EmetriqWindow;
  }

  config(): EmetriqModuleConfig {
    return this.moduleConfig;
  }

  init(config: Moli.MoliConfig, assetLoaderService: IAssetLoaderService): void {
    // init additional pipeline steps if not already defined
    config.pipeline = config.pipeline || {
      initSteps: [],
      configureSteps: [],
      prepareRequestAdsSteps: []
    };

    config.pipeline.initSteps.push(
      mkInitStep(this.name, ctx => {
        Emetriq.syncDelay(ctx, this.moduleConfig.syncDelay).then(additionalIdentifier => {
          switch (this.moduleConfig.os) {
            case 'web':
              this.loadEmetriqScript(
                ctx,
                this.moduleConfig,
                additionalIdentifier,
                assetLoaderService
              );
              break;
            case 'android':
            case 'ios':
              trackInApp(
                ctx,
                this.moduleConfig,
                additionalIdentifier,
                ctx.window.fetch,
                ctx.logger
              );
              break;
          }
        });

        return Promise.resolve();
      })
    );
  }

  loadEmetriqScript(
    context: AdPipelineContext,
    webConfig: EmetriqWebConfig,
    additionalIdentifier: EmetriqAdditionalIdentifier,
    assetLoaderService: IAssetLoaderService
  ): Promise<void> {
    // test environment doesn't require confiant
    if (context.env === 'test') {
      return Promise.resolve();
    }

    // no consent
    if (context.tcData.gdprApplies && !context.tcData.vendor.consents[this.gvlid]) {
      return Promise.resolve();
    }

    this.window._enqAdpParam = {
      ...webConfig._enqAdpParam,
      ...additionalIdentifier
    };

    return assetLoaderService.loadScript({
      name: this.name,
      loadMethod: AssetLoadMethod.TAG,
      assetUrl: `https://ups.xplosion.de/loader/${webConfig._enqAdpParam.sid}/default.js`
    });
  }

  /**
   * Returns a promise that delays the data tracking call.
   *
   * @param ctx ad pipeline context for `window` access
   * @param delay configuration of delay
   */
  static syncDelay(
    ctx: AdPipelineContext,
    delay?: SyncDelay
  ): Promise<EmetriqAdditionalIdentifier> {
    if (delay) {
      if (typeof delay === 'number') {
        return new Promise(resolve => ctx.window.setTimeout(() => resolve({}), delay));
      } else {
        if (ctx.window.pbjs) {
          return new Promise(resolve => {
            ctx.window.pbjs.que.push(() => {
              const listener = () => {
                resolve(Emetriq.prebidIdentifiers(ctx));
                ctx.window.pbjs.offEvent('auctionEnd', listener);
              };
              ctx.window.pbjs.onEvent('auctionEnd', listener);
            });
          });
        } else {
          ctx.logger.error('emetriq', 'No sync delay, because window.pbjs is not defined!');
          return Promise.resolve({});
        }
      }
    }
    // default is no delay
    return Promise.resolve({});
  }

  /**
   * This method assumes that `window.pbjs` is available and loaded. Call this only inside of
   * a `window.pbjs.que(() => ...)` callback.
   *
   * @param ctx ad pipeline context to access `pbjs`
   */
  static prebidIdentifiers(ctx: AdPipelineContext): EmetriqAdditionalIdentifier {
    const identifier: Mutable<EmetriqAdditionalIdentifier> = {};
    const userIds = ctx.window.pbjs.getUserIds();
    if (userIds.amxId) {
      identifier.id_amxid = userIds.amxId;
    }
    if (userIds.criteoId) {
      identifier.id_criteoid = userIds.criteoId;
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
      identifier.id_id5 = userIds.id5id;
    }
    return identifier;
  }
}
