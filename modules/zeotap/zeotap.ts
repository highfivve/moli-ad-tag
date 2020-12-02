import {
  AssetLoadMethod,
  getLogger,
  IAssetLoaderService,
  IModule,
  mkConfigureStep,
  mkInitStep,
  ModuleType,
  Moli
} from '@highfivve/ad-tag';

/**
 * Used to specify which keys to extract from moli's targeting (key/value pairs) and which key then to use in the
 * Zeotap request URL.
 *
 * For example, if you want to transfer a key/value pair with the key `xyz` to Zeotap under the name `abc`, the
 * respective DataKeyValue object would be:
 *
 * const transferXyz: DataKeyValue = {
 *   keyValueKey: 'xyz',
 *   parameterKey: 'abc'
 * }
 */
type DataKeyValue = {
  keyValueKey: string;
  parameterKey: string;
};

/**
 * Used to specify key/value pairs that will disable data collection (i.e. disable loading the Zeotap script).
 *
 * For example, if you want to disable data collection on sensitive content like medical content, the respective
 * ExclusionKeyValue object could look like this:
 *
 * const excludeMedical: ExclusionKeyValue = {
 *   keyValueKey: 'contentType',
 *   parameterKey: 'MedicalTopic'
 * }
 */
type ExclusionKeyValue = {
  keyValueKey: string;
  disableOnValue: string;
};

type ZeotapModuleConfig = {
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
 * This module provides Zeotap's data collection and identity plus (id+/idp) functionality to moli.
 *
 * @see: https://zeotap.com/
 */
export default class Zeotap implements IModule {
  public readonly name: string = 'zeotap';
  public readonly description: string =
    'Provides Zeotap functionality (data collection and identity plus) to Moli.';
  public readonly moduleType: ModuleType = 'identity';

  private readonly window: Window;
  private assetLoaderService: IAssetLoaderService | undefined;
  private logger: Moli.MoliLogger | undefined;

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
          this.loadScript(context.config);

          return Promise.resolve();
        })
      );
    } else {
      config.pipeline.configureSteps.push(
        mkConfigureStep(this.name, context => {
          this.loadScript(context.config);

          return Promise.resolve();
        })
      );
    }
  }

  /**
   * Let the asset loader load the script (again).
   *
   * The script is only loaded if the targeting exclusions don't match the provided targeting key/values from the moli
   * config.
   */
  private loadScript = (config: Moli.MoliConfig): Promise<void> => {
    const {
      mode,
      dataKeyValues,
      exclusionKeyValues,
      assetUrl,
      hashedEmailAddress,
      countryCode
    } = this.moduleConfig;

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

    const url =
      assetUrl +
      `&idp=${!!this.moduleConfig.hashedEmailAddress ? 1 : 0}` +
      (customData.length > 0 ? `&${customData}` : '') +
      (countryCode ? `&ctry=${countryCode}` : '') +
      (hashedEmailAddress ? `&z_e_sha2_l=${hashedEmailAddress}` : '');

    this.loadScriptCount++;

    return this.assetLoaderService?.loadScript({
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
