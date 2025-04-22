/**
 * # [Utiq](https://utiq.com/)
 *
 * ## Integration
 *
 * In your `index.ts` import confiant and register the module.
 *
 * ```js
 * import { Utiq } from '@highfivve/module-utiq';
 * moli.registerModule(new Utiq({
 *   assetUrl: 'https://utiq.example.com/utiqLoader.js'
 * }));
 * ```
 *
 * ## Resources
 *
 * - [Utiq docs](https://docs.utiq.com/docs)
 *
 * @module
 */
import { IModule, ModuleType } from 'ad-tag/types/module';
import { tcfapi } from 'ad-tag/types/tcfapi';
import { modules } from 'ad-tag/types/moliConfig';
import {
  AdPipelineContext,
  ConfigureStep,
  InitStep,
  mkInitStep,
  PrepareRequestAdsStep
} from 'ad-tag/ads/adPipeline';
import { AssetLoadMethod } from 'ad-tag/util/assetLoaderService';

type UtiqCommand = () => void;

/**
 * @see https://docs.utiq.com/docs/event-listeners#EventListeners-onConsentManagerStatusChanged
 */
type UtiqStatus = 'utiq_popup_shown' | 'utiq_popup_accepted' | 'utiq_popup_rejected';

/**
 * category will return 'mobile' or 'fixed', to differentiate if Utiq IDs are generated based the
 * mobile connection, or the fixed (household) connection.
 *
 * @see https://docs.utiq.com/docs/event-listeners#EventListeners-onIdsAvailable
 */
interface UtiqIdsAvailableEvent {
  mtid: string;
  atid: string;
  attrid: string;
  category: 'mobile' | 'fixed';
  ttl: string;
  domain: string;
}

/**
 * @see https://docs.utiq.com/docs/event-listeners
 */
interface UtiqEventMap {
  /**
   * This event is dispatched when the Utiq is fully initialized on every page load or navigation.
   *
   * @see https://docs.utiq.com/docs/event-listeners#EventListeners-onInitialised
   */
  onInitialised: () => void;

  /**
   * This event is dispatched when user eligibility check information is performed for the current client sending it
   * with the parameter. The check occurs on initial page load, when the eligibility is validated before the Utiq loads,
   * and on the consent acceptance.
   *
   * @see https://docs.utiq.com/docs/event-listeners#EventListeners-onEligibilityChecked
   */
  onEligibilityChecked: (event: { isEligible: boolean }) => void;

  /**
   * This event is dispatched when the Utiq gets signal from the browser (or client) to change the consent status to
   * the one held with the parameter. The fact that the event is dispatched does not mean the consent will be changed -
   * only that the signal has been sent. Further flow execution can be stopped by e.g. feedback that the consent already
   * has the specified value
   *
   * @see https://docs.utiq.com/docs/event-listeners#EventListeners-onConsentChanging
   */
  onConsentChanging: (event: { isConsentGranted: boolean }) => void;

  /**
   * This event is dispatched when Utiq consent status update has finished to the one held with the parameter.
   *
   * @see https://docs.utiq.com/docs/event-listeners#EventListeners-onConsentUpdateFinished
   */
  onConsentUpdateFinished: (event: { isConsentGranted: boolean }) => void;

  /**
   * The event is dispatched each time the status of consent is changed. The possible values can be:
   *
   * - `utiq_popup_shown`
   * - `utiq_popup_accepted`
   * - `utiq_popup_rejected`
   *
   * The event is dispatched on the following situations:
   *
   * - when consent manager popup is shown to the user (utiq_popup_shown).
   * - when consent manager popup is accepted (utiq_popup_accepted).
   * - when consent manager popup is rejected (utiq_popup_rejected).
   *
   * @see https://docs.utiq.com/docs/event-listeners#EventListeners-onConsentManagerStatusChanged
   */
  onConsentManagerStatusChanged: (event: { status: UtiqStatus }) => void;

  /**
   * This event is dispatched when Utiq's mtid and atid are available for use and provides them via its parameters.
   * It happens when the full Utiq flow is executed successfully and on the subsequent page loads when the IDs are
   * already set up.
   *
   * @see https://docs.utiq.com/docs/event-listeners#EventListeners-onIdsAvailable
   */
  onIdsAvailable: (event: UtiqIdsAvailableEvent) => void;

  /**
   * This event is dispatched when Utiq has completed its flow, either user was eligible and accepted/rejected, user
   * had accepted/rejected on previous session, or user was not eligible.
   *
   * Use case would be to use this event listener if you want to call other solutions as soon as Utiq flow ends, e.g.
   * not calling Prebid after CMP but wait to call it when this event listener fires.
   *
   * @see https://docs.utiq.com/docs/event-listeners#EventListeners-onFlowCompleted
   */
  onFlowCompleted: () => void;
}

type UtiqEventType = keyof UtiqEventMap;
type UtiqEventListener<T extends UtiqEventType> = (event: UtiqEventMap[T]) => void;

/**
 * The Utiq API object.
 *
 * NOTE: Only the methods we require in this module are listed here. Checks the docs if you need more and add them accordingly.
 *
 * @see https://docs.utiq.com/docs/api-methods
 */
export interface UtiqAPI {
  /**
   * Displays the Utiq Consent Manager overlay popup. This method operates with the default Utiq consent management setup.
   * Find more details on the []Utiq dedicated consent popup page](https://docs.utiq.com/docs/1b-consent-experience-utiq-separate-pop-up-model-u).
   *
   * @see https://docs.utiq.com/docs/api-methods#APIMethods-showConsentManager
   */
  showConsentManager(): void;

  /**
   *
   * @param event
   * @param listener
   * @see https://docs.utiq.com/docs/event-listeners
   */
  addEventListener<T extends UtiqEventType>(event: T, listener: UtiqEventListener<T>): void;

  /**
   *
   * @param event
   * @param listener
   * @see https://docs.utiq.com/docs/event-listeners
   */
  removeEventListener<T extends UtiqEventType>(event: T, listener: UtiqEventListener<T>): void;

  /**
   * @param entryName - Name of the entry that should be extracted from the ID graph.
   *                  Accepted values are: `mtid`, `atid`, `attrid`, `category`, `ttl`, `domain`
   * @see https://docs.utiq.com/docs/api-methods#APIMethods-getIdGraphEntry
   */
  getIdGraphEntry(entryName: string): string;
}

export type UtiqWindow = {
  Utiq?: {
    queue: Pick<UtiqCommand[], 'push'>;

    /**
     * The Utiq loader script can be configured using the Utiq.config object. Will be set from the config options provided
     * in the module configuration.
     */
    config?: modules.utiq.UtiqConfigOptions;

    /**
     * public API methods. Only available after the Utiq script is loaded.
     */
    API?: UtiqAPI;
  };
};

const requiredPurposeIds = [
  tcfapi.responses.TCPurpose.STORE_INFORMATION_ON_DEVICE,
  tcfapi.responses.TCPurpose.SELECT_BASIC_ADS,
  tcfapi.responses.TCPurpose.CREATE_PERSONALISED_ADS_PROFILE,
  tcfapi.responses.TCPurpose.SELECT_PERSONALISED_ADS,
  tcfapi.responses.TCPurpose.CREATE_PERSONALISED_CONTENT_PROFILE,
  tcfapi.responses.TCPurpose.SELECT_PERSONALISED_CONTENT,
  tcfapi.responses.TCPurpose.MEASURE_AD_PERFORMANCE,
  tcfapi.responses.TCPurpose.MEASURE_CONTENT_PERFORMANCE,
  tcfapi.responses.TCPurpose.APPLY_MARKET_RESEARCH,
  tcfapi.responses.TCPurpose.DEVELOP_IMPROVE_PRODUCTS,
  tcfapi.responses.TCPurpose.USE_LIMITED_DATA_TO_SElECT_CONTENT
];

export const createUtiq = (): IModule => {
  let utiqConfig: modules.utiq.UtiqConfig | null = null;

  const loadUtiq = (config: modules.utiq.UtiqConfig, context: AdPipelineContext): Promise<void> => {
    if (context.env__ === 'test') {
      return Promise.resolve();
    }

    const utiqWindow = context.window__ as unknown as UtiqWindow;
    utiqWindow.Utiq = utiqWindow.Utiq
      ? { ...utiqWindow.Utiq, config: { ...utiqWindow.Utiq.config, ...config.options } }
      : { queue: [], config: config.options };

    utiqWindow.Utiq.queue = utiqWindow.Utiq.queue || [];

    if (
      context.tcData__.gdprApplies &&
      requiredPurposeIds.some(
        purposeId => context.tcData__.gdprApplies && !context.tcData__.purpose.consents[purposeId]
      )
    ) {
      return Promise.resolve();
    }

    return context.assetLoaderService__
      .loadScript({
        name: 'utiq',
        loadMethod: AssetLoadMethod.TAG,
        assetUrl: config.assetUrl
      })
      .catch(error => context.logger__.error('failed to load utiq', error));
  };

  return {
    name: 'utiq',
    description: 'user module',
    moduleType: 'identity' as ModuleType,

    config__(): Object | null {
      return utiqConfig;
    },

    configure__(moduleConfig?: modules.ModulesConfig) {
      if (moduleConfig?.utiq && moduleConfig.utiq.enabled) {
        utiqConfig = moduleConfig.utiq;
      }
    },

    initSteps__(): InitStep[] {
      return utiqConfig?.enabled ? [mkInitStep('utiq', ctx => loadUtiq(utiqConfig!, ctx))] : [];
    },

    configureSteps__(): ConfigureStep[] {
      return [];
    },

    prepareRequestAdsSteps__(): PrepareRequestAdsStep[] {
      return [];
    }
  };
};
