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
import TCDataNoGDPR = tcfapi.responses.TCDataNoGDPR;
import TCDataWithGDPR = tcfapi.responses.TCDataWithGDPR;
import { googleAdManager, modules } from 'ad-tag/types/moliConfig';
import {
  InitStep,
  ConfigureStep,
  PrepareRequestAdsStep,
  mkConfigureStepOncePerRequestAdsCycle,
  mkInitStep
} from 'ad-tag/ads/adPipeline';
import { AssetLoadMethod, IAssetLoaderService } from 'ad-tag/util/assetLoaderService';
import { tcfapi } from 'ad-tag/types/tcfapi';
import { IModule, ModuleType } from 'ad-tag/types/module';
import { MoliRuntime } from 'ad-tag/types/moliRuntime';
import { MoliConfig } from 'ad-tag/types/moliConfig';

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

  private logger: MoliRuntime.MoliLogger | undefined;

  private gvlid: number = 301;

  /**
   * Keeps track of how often the script was loaded. Used to prevent reloading the script in default mode.
   */
  private loadScriptCount: number = 0;

  private zeotapConfig: modules.zeotap.ZeotapModuleConfig | null = null;

  config__(): modules.zeotap.ZeotapModuleConfig | null {
    return this.zeotapConfig;
  }

  configure__(moduleConfig?: modules.ModulesConfig): void {
    if (moduleConfig?.zeotap && moduleConfig.zeotap.enabled) {
      this.zeotapConfig = moduleConfig.zeotap;
    }
  }

  initSteps__(): InitStep[] {
    const config = this.zeotapConfig;
    return config && config.mode === 'default'
      ? [
          mkInitStep(this.name, context => {
            if (this.hasConsent(context.tcData__)) {
              this.loadScript(context.config__, context.assetLoaderService__, config).catch(error =>
                context.logger__.error(this.name, error)
              );
            }
            return Promise.resolve();
          })
        ]
      : [];
  }

  configureSteps__(): ConfigureStep[] {
    const config = this.zeotapConfig;
    return config && config.mode === 'spa'
      ? [
          mkConfigureStepOncePerRequestAdsCycle(this.name, context => {
            this.loadScript(context.config__, context.assetLoaderService__, config).catch(error =>
              context.logger__.error(this.name, error)
            );

            return Promise.resolve();
          })
        ]
      : [];
  }

  prepareRequestAdsSteps__(): PrepareRequestAdsStep[] {
    return [];
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
  private loadScript = (
    config: MoliConfig,
    assetLoaderService: IAssetLoaderService,
    moduleConfig: modules.zeotap.ZeotapModuleConfig
  ): Promise<void> => {
    const { mode, dataKeyValues, exclusionKeyValues, assetUrl, hashedEmailAddress, countryCode } =
      moduleConfig;

    if (!assetLoaderService) {
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
    const loadIdPlus: boolean = !!moduleConfig.hashedEmailAddress && this.loadScriptCount === 0;

    const url =
      assetUrl +
      `&idp=${loadIdPlus ? 1 : 0}` +
      (customData.length > 0 ? `&${customData}` : '') +
      (countryCode ? `&ctry=${countryCode}` : '') +
      (hashedEmailAddress ? `&z_e_sha2_l=${hashedEmailAddress}` : '');

    this.loadScriptCount++;

    return assetLoaderService.loadScript({
      name: this.name,
      loadMethod: AssetLoadMethod.TAG,
      assetUrl: url
    });
  };

  /**
   * Make a param=value pair string from a DataKeyValue object.
   */
  private parameterFromKeyValue = (
    kv: modules.zeotap.DataKeyValue,
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
    kv: modules.zeotap.ExclusionKeyValue,
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
    keyValues: googleAdManager.KeyValueMap | undefined
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
