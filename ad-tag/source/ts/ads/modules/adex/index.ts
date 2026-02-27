/**
 * # [The Adex](https://theadex.com/)
 *
 * The Adex is a Data Management Platform (DMP). Their script supports regular and SPA web
 * integrations.
 *
 * ## Integration
 *
 * In your `index.ts` import the Adex module and register the module.
 *
 * ```js
 * import { createAdexModule } from '@highfivve/module-the-adex-dmp';
 * moli.registerModule(createAdexModule());
 * ```
 *
 * ## Resources
 *
 * - [The Adex DMP Dashboard](https://www.adex.is/login)
 *
 * @module
 */
import { googleAdManager, modules } from 'ad-tag/types/moliConfig';
import { IModule, ModuleType } from 'ad-tag/types/module';
import {
  AdPipelineContext,
  ConfigureStep,
  InitStep,
  mkConfigureStep,
  mkInitStep,
  PrepareRequestAdsStep
} from 'ad-tag/ads/adPipeline';
import { AssetLoadMethod } from 'ad-tag/util/assetLoaderService';
import { isNotNull } from 'ad-tag/util/arrayUtils';
import { sendAdvertisingID } from 'ad-tag/ads/modules/adex/sendAdvertisingId';
import { tcfapi } from 'ad-tag/types/tcfapi';
import TCPurpose = tcfapi.responses.TCPurpose;
import {
  toAdexListType,
  toAdexMapType,
  toAdexStringOrNumberType
} from 'ad-tag/ads/modules/adex/adex-mapping';
import { trackUtiqId } from 'ad-tag/ads/modules/adex/adexUtiq';

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
 * Basic core plugin that collects the users' configurations, such as screen sizes, time & date,
 * location, the current page information and various settings.
 */
interface IUserTrackPluginKeyValueCommand {
  [0]: string;
  [1]: 'ut';
  [2]: '_kv';
  [3]: {
    [0]: modules.adex.AdexKeyValues;
    [1]: 0 | 1;
  };
}

/**
 * ## Cookie Matching Plugin
 */
interface ICookieMatchingPluginCommand {
  [0]: string;
  [1]: 'cm';
  [2]: '_cm';
  [3]: [number, string];
}

export interface IAdexModule extends IModule {
  track(context: AdPipelineContext, adexConfig: modules.adex.AdexConfig): Promise<void>;
  hasRequiredConsent(tcData: tcfapi.responses.TCData): boolean;
}

/**
 * Module to collect, convert and send key/value targeting data to The Adex DMP.
 */
export const createAdexModule = (): IAdexModule => {
  const name = 'the-adex-dmp';
  let adexConfig: modules.adex.AdexConfig | null = null;
  let isLoaded: boolean = false;

  const config__ = (): modules.adex.AdexConfig | null => adexConfig;

  const configure__ = (moduleConfig?: modules.ModulesConfig) => {
    if (moduleConfig?.adex && moduleConfig.adex.enabled) {
      adexConfig = moduleConfig.adex;
    }
  };

  const getOrInitAdexQueue = (_window: Window): ITheAdexWindow => {
    const adexWindow = _window as ITheAdexWindow;
    adexWindow._adexc = adexWindow._adexc || [];
    return adexWindow;
  };

  const getAdexKeyValues = (
    context: AdPipelineContext,
    config: modules.adex.AdexConfig
  ): (modules.adex.AdexKeyValuePair | modules.adex.AdexKeyValueMap)[] | undefined => {
    const gamKeyValues: googleAdManager.KeyValueMap = {
      ...context.config__.targeting?.keyValues,
      ...context.runtimeConfig__.keyValues
    };

    if (Object.keys(gamKeyValues).length > 0) {
      return config.mappingDefinitions
        .map(def => {
          switch (def.adexValueType) {
            case 'map':
              return toAdexMapType(gamKeyValues, def, context.logger__);
            case 'list':
              return toAdexListType(gamKeyValues, def, context.logger__);
            default:
              return toAdexStringOrNumberType(gamKeyValues, def, context.logger__);
          }
        })
        .filter(isNotNull);
    }
  };

  const hasRequiredConsent = (tcData: tcfapi.responses.TCData): boolean =>
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

  const configureAdexC = (context: AdPipelineContext, config: modules.adex.AdexConfig): void => {
    const adexWindow = getOrInitAdexQueue(context.window__);
    const adexKeyValues = getAdexKeyValues(context, config);
    if (!adexKeyValues) {
      context.logger__.warn('Adex DMP', 'targeting key/values are empty');
    } else {
      adexWindow._adexc.push([
        `/${config.adexCustomerId}/${config.adexTagId}/`,
        'ut', // usertrack
        '_kv', // key values
        [
          adexKeyValues.reduce(
            (
              aggregator: modules.adex.AdexKeyValues,
              additionalKeyValue: modules.adex.AdexKeyValues
            ) => ({ ...aggregator, ...additionalKeyValue }) as modules.adex.AdexKeyValues,
            {}
          ),
          // single page mode for logged-in
          config.spaMode ? 1 : 0
        ]
      ]);
    }
    if (config.enabledPartners?.includes('utiq')) {
      trackUtiqId(config, context.window__ as any);
    }
  };

  /**
   * If consent was given, extract data for The Adex from key/value targeting information.
   *
   * Abort only if
   * - no consent was given
   * - key/value targeting is empty
   * - after mapping to The Adex compatible data, the Adex targeting is empty
   */
  const track = (context: AdPipelineContext, config: modules.adex.AdexConfig): Promise<void> => {
    const { adexCustomerId, adexTagId, appConfig, appName } = config;

    configureAdexC(context, config);
    const adexKeyValues = getAdexKeyValues(context, config);

    const gamKeyValues: googleAdManager.KeyValueMap = {
      ...context.config__.targeting?.keyValues,
      ...context.runtimeConfig__.keyValues
    };

    // load script or make request (appMode) if consent is given
    if (hasRequiredConsent(context.tcData__) && !isLoaded && Object.keys(gamKeyValues).length > 0) {
      isLoaded = true;
      // if user comes via app (clientType is 'android' or 'ios'), make a request to the in-app endpoint instead of loading the script
      const hasValidMobileKeyValues: boolean =
        // appConfig is not undefined or null
        isNotNull(appConfig) &&
        // advertisingId must be set in dfpKeyValues
        isNotNull(gamKeyValues[appConfig.advertiserIdKey]) &&
        // clientType must be either 'ios' or 'android'
        (gamKeyValues[appConfig.clientTypeKey] === 'android' ||
          gamKeyValues[appConfig.clientTypeKey] === 'ios');

      if (appConfig?.advertiserIdKey && hasValidMobileKeyValues) {
        const consentString = context.tcData__.gdprApplies ? context.tcData__.tcString : undefined;

        // only send request if advertisingId is a single string (no array)
        const advertisingIdValue = gamKeyValues[appConfig.advertiserIdKey];
        typeof advertisingIdValue === 'string' &&
          adexKeyValues &&
          sendAdvertisingID(
            adexCustomerId,
            appConfig.adexMobileTagId ? appConfig.adexMobileTagId : adexTagId,
            appName,
            advertisingIdValue,
            adexKeyValues,
            gamKeyValues[appConfig.clientTypeKey] ?? '',
            context.window__.fetch,
            context.logger__,
            consentString
          );
      } else {
        context.assetLoaderService__
          .loadScript({
            name,
            assetUrl: `https://dmp.theadex.com/d/${adexCustomerId}/${adexTagId}/s/adex.js`,
            loadMethod: AssetLoadMethod.TAG
          })
          .catch(error => context.logger__.error('failed to load adex', error));
      }
    }

    return Promise.resolve();
  };

  const initSteps__ = (): InitStep[] => {
    const config = adexConfig;
    if (config) {
      return [mkInitStep('DMP module setup', context => track(context, config))];
    }
    return [];
  };

  const configureSteps__ = (): ConfigureStep[] => {
    const config = adexConfig;
    if (config?.spaMode) {
      return [
        mkConfigureStep('DMP module setup', context => {
          // this is a side effect by choise as DMP configuring should not affect the pipeline
          configureAdexC(context, config);
          return Promise.resolve();
        })
      ];
    }
    return [];
  };

  const prepareRequestAdsSteps__ = (): PrepareRequestAdsStep[] => [];

  return {
    name,
    description: 'Moli DMP module for The Adex.',
    moduleType: 'dmp' as ModuleType,
    config__,
    configure__,
    initSteps__,
    configureSteps__,
    prepareRequestAdsSteps__,
    track,
    hasRequiredConsent
  };
};
