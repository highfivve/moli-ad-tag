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
import { trackUtiqId } from './adexUtiq';

export interface ITheAdexWindow extends Window {
  /**
   * The Adex command queue.
   *
   * Takes an array of plugin configurations that configure the TheAdex
   * tracking pixel.
   */
  _adexc: AdexCommand[];
}

export type AdexCommand = IUserTrackPluginKeyValueCommand | ICookieMatchingPluginCommand;

/**
 * ## Usertrack Plugin KeyValue Configuration
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
interface IUserTrackPluginKeyValueCommand {
  /**
   * ## Instance parameter
   * ID for the instance that should be configured
   *
   * Shape: "/:CID/:TID/”
   *
   * CID: CustomerID
   * TID: TagID
   */
  [0]: string;
  /**
   * ## Plugin name
   *
   * Shortcut for `Usertrack`
   */
  [1]: 'ut';
  /**
   * ## Command name
   *
   * Key Value setting
   */
  [2]: '_kv';

  /**
   * ## Values
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

/**
 * ## Cookie Matching Plugin
 *
 * The plugin cookie matching allows scripts to trigger a cookie match programmatically, based on
 * incoming commands (rather than using the URL callback from redirect pixels). This is useful when
 * you have exchange information that is only available after a user action has taken place on the
 * website (for example, logging in)
 *
 *```js
 * // Sending a foreign CookieID (fuid) from Partner (pid) to the DMP
 * window._adexc.push(['/:CID/:TID/','cm','_cm',['pid','fuid']]);
 * ```
 *
 * ## Custom endpoint and callback
 *
 * It's also possible to define a custom callback URL that points to your endpoint to retrieve
 * our identifier via the macro `"{{UUID}}"`.
 * This is done either by sending the dedicated _cb command or adding a third URL parameter to
 * the standard `_cm` command
 *
 * ```js
 * # Retrieving AdexUserID
 * window._adexc.push(['/:CID/:TID/','cm','_cb',['http://calback.url?id={{UUID}
 * }']]);
 * ```
 *
 * or
 *
 * ```js
 * # Sending a foreign CookieID (fuid) from Partner (pid)
 * # to the DMP including a callback
 * window._adexc.push(['/:CID/:TID/','cm','_cm',['pid','fid','http://calback.ur
 * l?id={{UUID}}']]);
 * ```
 *
 * @see https://api.theadex.com/collector/v1/docs/index.html#/Web%20Collection/get_d__customer___tag__i_2_gif
 */
interface ICookieMatchingPluginCommand {
  /**
   * ## Instance parameter
   * ID for the instance that should be configured
   *
   * Shape: "/:CID/:TID/”
   *
   * CID: CustomerID
   * TID: TagID
   */
  [0]: string;
  /**
   * ## Plugin name
   *
   * Shortcut for `Cookie Matching`
   */
  [1]: 'cm';
  /**
   * ## Command name
   */
  [2]: '_cm';

  /**
   * Foreign ID tuples. A tuple is [partnerId, foreignId].
   */
  [3]: [number, string];
}

export interface AdexAppConfig {
  /**
   * key within the moli config keyValues in which the client type is defined
   */
  readonly clientTypeKey: string;
  /**
   * key within the moli config keyValues in which the advertising id can be found
   */
  readonly advertiserIdKey: string;
  /**
   * extra tag id for the mobile endpoint data if distinction is wanted/necessary
   */
  readonly adexMobileTagId?: string;
}

export type AdexPartner = 'utiq';

/**
 * TheADEX module configuration.
 */
export interface AdexModuleConfig {
  /**
   * Provided by your ADEX account manager.
   */
  readonly adexCustomerId: string;

  /**
   * Provided by your ADEX account manager.
   */
  readonly adexTagId: string;
  /**
   * Name of the app (publisher code).
   */
  readonly appName: string;
  /**
   * For single page apps, enable spaMode. Tracking is then executed once per configuration cycle.
   * In regular mode, tracking is only executed once.
   */
  readonly spaMode: boolean;
  /**
   * extraction and conversion rules to produce Adex compatible data from key/value targeting.
   */
  readonly mappingDefinitions: Array<MappingDefinition>;
  /**
   * If there's an app version of the site, add the appConfig in order to make sure mobile data is sent to the Adex
   */
  readonly appConfig?: AdexAppConfig;

  /**
   * A list of partners where cookie matching calls should be performed.
   * @see https://api.theadex.com/collector/v1/docs/index.html#/Web%20Collection/get_d__customer___tag__i_2_gif
   */
  readonly enabledPartners?: AdexPartner[];
}

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
    const {
      adexCustomerId,
      adexTagId,
      spaMode,
      mappingDefinitions,
      appConfig,
      enabledPartners,
      appName
    } = this.config();
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

    if (enabledPartners?.includes('utiq')) {
      trackUtiqId(this.config(), this.window);
    }

    // load script or make request (appMode) if consent is given
    if (this.hasRequiredConsent(context.tcData) && !this.isLoaded) {
      this.isLoaded = true;

      // if user comes via app (clientType is 'android' or 'ios'), make a request to the in-app endpoint instead of loading the script
      const hasValidMobileKeyValues: boolean =
        // appConfig is not undefined or null
        isNotNull(appConfig) &&
        // advertisingId must be set in dfpKeyValues
        isNotNull(dfpKeyValues[appConfig.advertiserIdKey]) &&
        // clientType must be either 'ios' or 'android'
        (dfpKeyValues[appConfig.clientTypeKey] === 'android' ||
          dfpKeyValues[appConfig.clientTypeKey] === 'ios');

      if (appConfig?.advertiserIdKey && hasValidMobileKeyValues) {
        const consentString = context.tcData.gdprApplies ? context.tcData.tcString : undefined;

        // only send request if advertisingId is a single string (no array)
        const advertisingIdValue = dfpKeyValues[appConfig.advertiserIdKey];
        typeof advertisingIdValue === 'string' &&
          sendAdvertisingID(
            adexCustomerId,
            appConfig.adexMobileTagId ? appConfig.adexMobileTagId : adexTagId,
            advertisingIdValue,
            adexKeyValues,
            appName,
            dfpKeyValues[appConfig.clientTypeKey] ?? '',
            context.window.fetch,
            context.logger,
            consentString
          );
      } else {
        assetLoaderService
          .loadScript({
            name: this.name,
            assetUrl: `https://dmp.theadex.com/d/${adexCustomerId}/${adexTagId}/s/adex.js`,
            loadMethod: AssetLoadMethod.TAG
          })
          .catch(error => context.logger.error('failed to load adex', error));
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
