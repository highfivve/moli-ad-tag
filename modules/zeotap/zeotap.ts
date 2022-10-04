/**
 * # [Zeotap](https://zeotap.com) data and identity plus module
 *
 * This module provides Zeotap's data collection and identity provider functionality to moli.
 *
 * ## Integration
 *
 * In your `index.ts`, import Zeotap and register the module.
 *
 * ```js
 * import { Zeotap } from '@highfivve/module-zeotap';
 *
 * const zeotap = new Zeotap({
 *   assetUrl: '//spl.zeotap.com/mapper.js?env=mWeb&eventType=pageview&zdid=1337',
 *   countryCode: 'DEU',
 *   mode: 'default',
 *   hashedEmailAddress: 'somehashedaddress',
 *   dataKeyValues: [
 *     { keyValueKey: 'channel', parameterKey: 'zcat' },
 *     { keyValueKey: 'subChannel', parameterKey: 'zscat' },
 *     { keyValueKey: 'tags', parameterKey: 'zcid' }
 *   ],
 *   exclusionKeyValues: [
 *     { keyValueKey: 'channel', disableOnValue: 'MedicalHealth' },
 *     { keyValueKey: 'subChannel', disableOnValue: 'Pornography' }
 *   ]
 * });
 *
 * moli.registerModule(zeotap);
 * ```
 *
 * Configure the module with:
 *
 * - `assetUrl`: the zeotap `mapper.js` URL (can be protocol relative)
 * - `mode`: the mode you want to run the module in, depending on your site's structure. If you're running a single
 *   page application (SPA), select `spa` mode. Else, select `default`.
 * - `dataKeyValues`: Specifies which keys to extract from moli's targeting (key/value pairs) and which key then to use to
 *   transfer the extracted data in the Zeotap request URL.
 * - `exclusionKeyValues`: Specifies which key/value pairs should prevent the Zeotap script from being loaded, e.g. to
 *   prevent data collection in pages with sensitive topics such as medical/health content.
 * - `countryCode` _(optional)_: your site's Alpha-ISO3 country code. If omitted, Zeotap will guess the country from the
 *   sender's IP address.
 * - `hashedEmailAddress` _(optional)_: if you want to use Zeotap's id+ module, configure the module with a sha-256 hashed
 *   email address.
 *
 * @module zeotap
 */
import {
  AssetLoadMethod,
  IAssetLoaderService,
  getLogger,
  IModule,
  ModuleType,
  mkConfigureStep,
  mkInitStep,
  Moli,
  tcfapi
} from '@highfivve/ad-tag';
import TCDataNoGDPR = tcfapi.responses.TCDataNoGDPR;
import TCDataWithGDPR = tcfapi.responses.TCDataWithGDPR;

/**
 * Used to specify which keys to extract from moli's targeting (key/value pairs) and which key then to use in the
 * Zeotap request URL.
 *
 * For example, if you want to transfer a key/value pair with the key `xyz` to Zeotap under the name `abc`, the
 * respective DataKeyValue object would be:
 *
 * ```ts
 * const transferXyz: DataKeyValue = {
 *   keyValueKey: 'xyz',
 *   parameterKey: 'abc'
 * }
 * ```ts
 */
export type DataKeyValue = {
  keyValueKey: string;
  parameterKey: string;
};

/**
 * Used to specify key/value pairs that will disable data collection (i.e. disable loading the Zeotap script).
 *
 * For example, if you want to disable data collection on sensitive content like medical content, the respective
 * ExclusionKeyValue object could look like this:
 *
 * ```ts
 * const excludeMedical: ExclusionKeyValue = {
 *   keyValueKey: 'contentType',
 *   disableOnValue: 'MedicalTopic'
 * }
 * ```
 */
export type ExclusionKeyValue = {
  keyValueKey: string;
  disableOnValue: string;
};

export type ZeotapModuleConfig = {
  /**
   * Points to the Zeotap script, containing only env, eventType and zdid parameters. The other parameters (country
   * code, idp, hashed email address, and custom parameters) are added through configuration parameters.
   *
   * @example //spl.zeotap.com/mapper.js?env=mWeb&eventType=pageview&zdid=1337
   */
  readonly assetUrl: string;

  /**
   * Optional Alpha-ISO3 country code, e.g. "DEU". If empty, Zeotap will guess the country from the requests's IP
   * address.
   */
  readonly countryCode?: string;

  /**
   * sha-256 hash of the user's email address. If you pass an email address here, the idplus module will be activated.
   */
  readonly hashedEmailAddress?: string;

  /**
   * The mode defines if the Zeotap script can be loaded repeatedly with updated parameters (in spa/single page
   * application mode) or just once (for sever side rendered pages, mode = default).
   */
  readonly mode: 'spa' | 'default';

  /**
   * Specifies which keys to extract from moli's targeting (key/value pairs) and which key then to use to transfer the
   * extracted data in the Zeotap request URL.
   */
  readonly dataKeyValues: Array<DataKeyValue>;

  /**
   * Specifies which key/value pairs should prevent the Zeotap script from being loaded, e.g. to prevent data collection
   * in pages with sensitive topics such as medical/health content.
   */
  readonly exclusionKeyValues: Array<ExclusionKeyValue>;
};

/**
 * # Zeotap / ID+
 *
 * This module provides Zeotap's data collection and identity plus (id+/idp) functionality to moli.
 *
 * @see: https://zeotap.com/
 */
export class Zeotap implements IModule {
  public readonly name: string = 'zeotap';
  public readonly description: string =
    'Provides Zeotap functionality (data collection and identity plus) to Moli.';
  public readonly moduleType: ModuleType = 'identity';

  private readonly window: Window;
  private assetLoaderService: IAssetLoaderService | undefined;
  private logger: Moli.MoliLogger | undefined;

  private gvlid: number = 301;

  /**
   * Keeps track of how often the script was loaded. Used to prevent reloading the script in default mode.
   */
  private loadScriptCount: number = 0;

  constructor(private readonly moduleConfig: ZeotapModuleConfig, window: Window) {
    this.window = window;
  }

  config(): ZeotapModuleConfig {
    return this.moduleConfig;
  }

  init(config: Moli.MoliConfig, assetLoaderService: IAssetLoaderService): void {
    this.assetLoaderService = assetLoaderService;
    this.logger = getLogger(config, this.window);

    // init additional pipeline steps if not already defined
    config.pipeline = config.pipeline || {
      initSteps: [],
      configureSteps: [],
      prepareRequestAdsSteps: []
    };

    if (this.moduleConfig.mode === 'default') {
      config.pipeline.initSteps.push(
        mkInitStep(this.name, context => {
          if (this.hasConsent(context.tcData)) {
            this.loadScript(context.config);
          }

          return Promise.resolve();
        })
      );
    } else {
      config.pipeline.configureSteps.push(
        mkConfigureStep(this.name, context => {
          this.loadScript(context.config).catch(error => context.logger.error(this.name, error));

          return Promise.resolve();
        })
      );
    }
  }

  private hasConsent = (tcData: TCDataNoGDPR | TCDataWithGDPR): boolean => {
    if (tcData.gdprApplies) {
      return (
        tcData.vendor.consents[this.gvlid] &&
        tcData.purpose.consents[tcfapi.responses.TCPurpose.STORE_INFORMATION_ON_DEVICE] &&
        tcData.purpose.consents[tcfapi.responses.TCPurpose.CREATE_PERSONALISED_ADS_PROFILE] &&
        tcData.purpose.consents[tcfapi.responses.TCPurpose.SELECT_PERSONALISED_ADS] &&
        tcData.purpose.consents[tcfapi.responses.TCPurpose.CREATE_PERSONALISED_CONTENT_PROFILE] &&
        tcData.purpose.consents[tcfapi.responses.TCPurpose.SELECT_PERSONALISED_CONTENT] &&
        tcData.purpose.consents[tcfapi.responses.TCPurpose.MEASURE_AD_PERFORMANCE] &&
        tcData.purpose.consents[tcfapi.responses.TCPurpose.APPLY_MARKET_RESEARCH] &&
        tcData.purpose.consents[tcfapi.responses.TCPurpose.DEVELOP_IMPROVE_PRODUCTS]
      );
    }
    return true;
  };

  /**
   * Let the asset loader load the script (again).
   *
   * The script is only loaded if the targeting exclusions don't match the provided targeting key/values from the moli
   * config.
   */
  private loadScript = (config: Moli.MoliConfig): Promise<void> => {
    const { mode, dataKeyValues, exclusionKeyValues, assetUrl, hashedEmailAddress, countryCode } =
      this.moduleConfig;

    if (!this.assetLoaderService) {
      return Promise.reject('Zeotap module :: no asset loader found, module not initialized yet?');
    }

    if (mode === 'default' && this.loadScriptCount > 0) {
      return Promise.reject("Zeotap module :: can't reload script in default mode.");
    }

    const keyValuesMap = this.makeKeyValuesMap(config.targeting?.keyValues);

    // bail early if the targeting key/values contain one of the exclusion criteria
    if (exclusionKeyValues.some(kv => this.isExclusionKeyValueSet(kv, keyValuesMap))) {
      return Promise.reject('Zeotap module :: targeting exclusions prevented loading the script.');
    }

    const customData = dataKeyValues
      .map(kv => this.parameterFromKeyValue(kv, keyValuesMap))
      .join('&');

    // load id+ only on the first call and if a hashed email is available
    const loadIdPlus: boolean =
      !!this.moduleConfig.hashedEmailAddress && this.loadScriptCount === 0;

    const url =
      assetUrl +
      `&idp=${loadIdPlus ? 1 : 0}` +
      (customData.length > 0 ? `&${customData}` : '') +
      (countryCode ? `&ctry=${countryCode}` : '') +
      (hashedEmailAddress ? `&z_e_sha2_l=${hashedEmailAddress}` : '');

    this.loadScriptCount++;

    return this.assetLoaderService.loadScript({
      name: this.name,
      loadMethod: AssetLoadMethod.TAG,
      assetUrl: url
    });
  };

  /**
   * Make a param=value pair string from a DataKeyValue object.
   */
  private parameterFromKeyValue = (
    kv: DataKeyValue,
    keyValuesMap: Map<string, string | Array<string>>
  ): string => {
    const value = keyValuesMap.get(kv.keyValueKey);

    if (Array.isArray(value)) {
      return `${kv.parameterKey}=${encodeURIComponent(value.join(','))}`;
    }

    return `${kv.parameterKey}=${encodeURIComponent(value || '')}`;
  };

  /**
   * Check if the key/values map from the moli config contains the given ExclusionKeyValue.
   */
  private isExclusionKeyValueSet = (
    kv: ExclusionKeyValue,
    keyValuesMap: Map<string, string | Array<string>>
  ): boolean => {
    const value = keyValuesMap.get(kv.keyValueKey);

    if (Array.isArray(value)) {
      return value.indexOf(kv.disableOnValue) > -1;
    }

    return value === kv.disableOnValue;
  };

  /**
   * Convert the key/values object from the moli config to an actual map, filtering out entries with falsy values.
   */
  private makeKeyValuesMap = (
    keyValues: Moli.DfpKeyValueMap | undefined
  ): Map<string, string | Array<string>> => {
    return keyValues
      ? new Map(
          Object.keys(keyValues)
            .map(key => [key, keyValues[key]] as [string, string | Array<string> | undefined])
            .filter(([, value]) => !!value)
        )
      : new Map();
  };
}
