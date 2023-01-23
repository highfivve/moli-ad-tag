/**
 * # [The Adex](https://theadex.com/)
 *
 * The Adex is a Data Management Platform (DMP). Their script supports regular and SPA web
 * integrations.
 *
 * Using the following mapping definition, you could transform a `channel` key/value into a format
 * The Adex understands:
 *
 * ```js
 * // mapping definition
 * { adexValueType: 'string', key: 'channel', attribute: 'iab_cat' }
 * ```
 * ```js
 * // input key/value from moli targeting
 * { channel: 'Education' }
 * ```
 * ```js
 * // the adex compatible mapped output
 * { iab_cat: 'Education' }
 * ```
 *
 * ## Integration
 *
 * In your `index.ts` import the Adex module and register the module.
 *
 * ```js
 * import { AdexModule } from '@highfivve/module-the-adex-dmp';
 * moli.registerModule(new AdexModule({
 *   mappingDefinitions: [{ adexValueType: 'string', key: 'channel', attribute: 'iab_cat' }],
 *   adexCustomerId: '1234',
 *   adexTagId: '1337',
 *   spaMode: false // non-spa web project
 * }, window, logger));
 * ```
 *
 * ### App/mobile data
 *
 * If the ad tag is also used in apps and you would like to send mobile data to the Adex, add the `appConfig` object:
 *
 * The object has the following parameters (keys need to be available in the keyValues of the moli config):
 * - `clientTypeKey`: the key in which information about the clientType ('android' | 'ios') can be found
 * - `advertiserKey`: the key in which the advertising id can be found
 * - `adexMobileTagId` (optional): extra id can be added to distinguish mobile (app) data from other Adex data
 *
 * ```js
 * import { AdexModule } from '@highfivve/module-the-adex-dmp';
 * moli.registerModule(new AdexModule({
 *   mappingDefinitions: [{ adexValueType: 'string', key: 'channel', attribute: 'iab_cat' }],
 *   adexCustomerId: '1234',
 *   adexTagId: '1337',
 *   spaMode: false // non-spa web project
 *   appConfig: {
 *     clientTypeKey: 'gf_clientType',
 *     advertiserIdKey: 'advertising_id',
 *     adexMobileTagId: '1447'
 *   }
 * }, window, logger));
 * ```
 *
 * ## Resources
 *
 * - [The Adex DMP Dashboard](https://www.adex.is/login)
 *
 * @module
 */
import {
  AdPipeline,
  AdPipelineContext,
  AssetLoadMethod,
  IAssetLoaderService,
  IModule,
  isNotNull,
  mkConfigureStep,
  mkInitStep,
  ModuleType,
  tcfapi,
  Moli
} from '@highfivve/ad-tag';
import {
  AdexKeyValues,
  MappingDefinition,
  toAdexListType,
  toAdexMapType,
  toAdexStringOrNumberType
} from './adex-mapping';
import TCPurpose = tcfapi.responses.TCPurpose;
import { sendAdvertisingID } from './sendAdvertisingId';

export interface ITheAdexWindow extends Window {
  /**
   * The Adex command queue.
   *
   * Takes an array of plugin configurations that configure the The Adex
   * tracking pixel.
   */
  _adexc?: IUserTrackPluginKeyValueConfiguration[];
}

/**
 * == Usertrack Plugin KeyValue Configuration ==
 *
 * Basic core plugin that collects the users’ configurations, such as screen sizes, time & date,
 * location, the current page information and various settings.
 *
 * Collection of all page-related information is done by the User Track plugin.
 * Standard information that is collected includes among others:
 *
 * - Page title and metatag information
 * - Screen sizes
 * - Time of visit
 * - Duration of Page Visit
 * - Active timezone
 * - Browser and browser plugin information
 * - iFrame location (script is in top window or an embedded iframe)
 * - Trace source (see cookie recovering strategies)
 * - Reference field, allowing us to join information sent at different stages of the page load
 * - Optional freely defined key-value definitions (see below)
 * - Optional structured collection of campaign / advertising information
 */
interface IUserTrackPluginKeyValueConfiguration {
  /**
   * == Instance parameter ==
   * ID for the instance that should be configured
   *
   * Shape: "/:CID/:TID/”
   *
   * CID: CustomerID
   * TID: TagID
   */
  [0]: string;
  /**
   * == Plugin name ==
   *
   * Shortcut for `Usertrack`
   */
  [1]: 'ut';
  /**
   * == Command name ==
   *
   * Key Value setting
   */
  [2]: '_kv';

  /**
   * == Values ==
   *
   * The values for the _kv command
   *
   */
  [3]: {
    [0]: AdexKeyValues;

    /**
     * 0: (default) - user track can only be called once
     * 1: - user track can be called multiple times
     */
    [1]: 0 | 1;
  };
}

export interface AdexAppConfig {
  // key within the moli config keyValues in which the client type is defined
  clientTypeKey: string;
  // key within the moli config keyValues in which the advertising id can be found
  advertiserIdKey: string;
  // extra tag id for the mobile endpoint data if distinction is wanted/necessary
  adexMobileTagId?: string;
}

type AdexModuleConfig = {
  // Customer and tag id are provided by The Adex.
  adexCustomerId: string;
  adexTagId: string;
  // For single page apps, enable spaMode. Tracking is then executed once per configuration cycle.
  // In regular mode, tracking is only executed once.
  spaMode: boolean;
  // extraction and conversion rules to produce Adex compatible data from key/value targeting.
  mappingDefinitions: Array<MappingDefinition>;
  // If there's an app version of the site, add the appConfig in order to make sure mobile data is sent to the Adex
  appConfig?: AdexAppConfig;
};

/**
 * Module to collect, convert and send key/value targeting data to The Adex DMP.
 */
export class AdexModule implements IModule {
  public readonly name: string = 'the-adex-dmp';
  public readonly description: string = 'Moli DMP module for The Adex.';
  public readonly moduleType: ModuleType = 'dmp';

  private isLoaded: boolean = false;

  constructor(
    private readonly moduleConfig: AdexModuleConfig,
    private readonly window: ITheAdexWindow
  ) {}

  config(): AdexModuleConfig {
    return this.moduleConfig;
  }

  init(
    moliConfig: Moli.MoliConfig,
    assetLoaderService: IAssetLoaderService,
    getAdPipeline: () => AdPipeline
  ) {
    const { spaMode } = this.config();

    // init additional pipeline steps if not already defined
    moliConfig.pipeline = moliConfig.pipeline || {
      initSteps: [],
      configureSteps: [],
      prepareRequestAdsSteps: []
    };

    if (spaMode) {
      moliConfig.pipeline.configureSteps.push(
        mkConfigureStep('DMP module setup', context => this.track(context, assetLoaderService))
      );
    } else {
      moliConfig.pipeline.initSteps.push(
        mkInitStep('DMP module setup', context => this.track(context, assetLoaderService))
      );
    }
  }

  /**
   * If consent was given, extract data for The Adex from key/value targeting information.
   *
   * Abort only if
   * - no consent was given
   * - key/value targeting is empty
   * - after mapping to The Adex compatible data, the Adex targeting is empty
   */
  public track(context: AdPipelineContext, assetLoaderService: IAssetLoaderService): Promise<void> {
    const { adexCustomerId, adexTagId, spaMode, mappingDefinitions, appConfig } = this.config();
    const dfpKeyValues = context.config.targeting?.keyValues;
    if (!dfpKeyValues) {
      context.logger.warn('Adex DMP', 'targeting key/values are empty');
      return Promise.resolve();
    }

    const adexKeyValues: Array<AdexKeyValues> = mappingDefinitions
      .map(def => {
        switch (def.adexValueType) {
          case 'map':
            return toAdexMapType(dfpKeyValues, def, context.logger);
          case 'list':
            return toAdexListType(dfpKeyValues, def, context.logger);
          default:
            return toAdexStringOrNumberType(dfpKeyValues, def, context.logger);
        }
      })
      .filter(isNotNull);

    if (mappingDefinitions.length === 0 && adexKeyValues.length === 0) {
      context.logger.warn('Adex DMP', 'no Adex key/values produced');
    }

    this.window._adexc = this.window._adexc || [];
    this.window._adexc.push([
      `/${adexCustomerId}/${adexTagId}/`,
      'ut', // usertrack
      '_kv', // key values
      [
        adexKeyValues.reduce(
          (aggregator: AdexKeyValues, additionalKeyValue: AdexKeyValues) =>
            ({ ...aggregator, ...additionalKeyValue } as AdexKeyValues),
          {}
        ),
        // single page mode for logged-in
        spaMode ? 1 : 0
      ]
    ]);

    // load script or make request (appMode) if consent is given
    if (this.hasRequiredConsent(context.tcData) && !this.isLoaded) {
      this.isLoaded = true;

      // if user comes via app (clientType is 'android' or 'ios'), make a request to the in-app endpoint instead of loading the script
      if (
        appConfig &&
        (dfpKeyValues[appConfig.clientTypeKey] === 'android' ||
          dfpKeyValues[appConfig.clientTypeKey] === 'ios')
      ) {
        const consentString = 'tcString' in context.tcData ? context.tcData.tcString : undefined;

        sendAdvertisingID(
          adexCustomerId,
          appConfig.adexMobileTagId ? appConfig.adexMobileTagId : adexTagId,
          dfpKeyValues[appConfig.advertiserIdKey] ?? '',
          adexKeyValues,
          dfpKeyValues[appConfig.clientTypeKey] ?? '',
          context.window.fetch,
          consentString
        );
      } else {
        assetLoaderService.loadScript({
          name: this.name,
          assetUrl: `https://dmp.theadex.com/d/${adexCustomerId}/${adexTagId}/s/adex.js`,
          loadMethod: AssetLoadMethod.TAG
        });
      }
    }

    return Promise.resolve();
  }

  hasRequiredConsent = (tcData: tcfapi.responses.TCData): boolean =>
    !tcData.gdprApplies ||
    (tcData.vendor.consents['44'] &&
      [
        TCPurpose.STORE_INFORMATION_ON_DEVICE,
        TCPurpose.SELECT_BASIC_ADS,
        TCPurpose.CREATE_PERSONALISED_ADS_PROFILE,
        TCPurpose.SELECT_PERSONALISED_ADS,
        TCPurpose.CREATE_PERSONALISED_CONTENT_PROFILE,
        TCPurpose.SELECT_PERSONALISED_CONTENT,
        TCPurpose.MEASURE_AD_PERFORMANCE,
        TCPurpose.MEASURE_CONTENT_PERFORMANCE,
        TCPurpose.APPLY_MARKET_RESEARCH,
        TCPurpose.DEVELOP_IMPROVE_PRODUCTS
      ].every(purpose => tcData.purpose.consents[purpose]));
}
