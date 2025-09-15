import {
  AdPipelineContext,
  ConfigureStep,
  DefineSlotsStep,
  InitStep,
  LOW_PRIORITY,
  mkConfigureStep,
  mkConfigureStepOncePerRequestAdsCycle,
  mkInitStep,
  mkPrepareRequestAdsStep,
  PrepareRequestAdsStep,
  RequestAdsStep
} from './adPipeline';
import { Moli } from '../types/moli';
import { SizeConfigService } from './sizeConfigService';
import { googletag } from '../types/googletag';
import { isNotNull } from '../util/arrayUtils';
import { AssetLoadMethod, IAssetLoaderService } from '../util/assetLoaderService';
import { tcfapi } from '../types/tcfapi';
import { createTestSlots } from '../util/test-slots';
import SlotDefinition = Moli.SlotDefinition;
import TCPurpose = tcfapi.responses.TCPurpose;
import { resolveAdUnitPath } from './adUnitPath';
import { formatKey } from './keyValues';

/**
 * A dummy googletag ad slot for the test mode
 * @param domId
 * @param adUnitPath
 */
const testAdSlot = (domId: string, adUnitPath: string): googletag.IAdSlot => ({
  setCollapseEmptyDiv(): void {
    return;
  },
  addService(_service: googletag.IService<any>): void {
    return;
  },

  getSlotElementId(): string {
    return domId;
  },

  getAdUnitPath(): string {
    return adUnitPath;
  },

  setTargeting(_key: string, _value: string | string[]): googletag.IAdSlot {
    return this;
  },

  getTargeting(_key: string): string[] {
    return [];
  },

  getTargetingKeys(): string[] {
    return [];
  },

  clearTargeting(_key?: string): void {
    return;
  },
  getResponseInformation(): null | googletag.IResponseInformation {
    return null;
  },

  setConfig(_config: googletag.GptSlotSettingsConfig) {
    return;
  }
});

const configureTargeting = (
  window: Window & googletag.IGoogleTagWindow,
  targeting: Moli.Targeting | undefined
): void => {
  const keyValueMap = targeting ? targeting.keyValues : {};
  const excludes = targeting?.adManagerExcludes ?? [];
  Object.keys(keyValueMap)
    .filter(key => !excludes.includes(key))
    .forEach(key => {
      const value = keyValueMap[key];
      if (value) {
        window.googletag.pubads().setTargeting(key, value);
      }
    });
};

/**
 * This is a temporary workaround until gpt.js understands the tcfapi
 * @see https://support.google.com/admanager/answer/9805023
 */
const useStandardGpt = (
  tcData: tcfapi.responses.TCData,
  consentConfig?: Moli.consent.ConsentConfig
): boolean => {
  if (consentConfig?.useLimitedAds === false) {
    return true;
  }
  return (
    !tcData.gdprApplies ||
    (tcData.vendor.consents[755] &&
      tcData.purpose.consents[TCPurpose.STORE_INFORMATION_ON_DEVICE] &&
      [
        TCPurpose.SELECT_BASIC_ADS,
        TCPurpose.MEASURE_AD_PERFORMANCE,
        TCPurpose.APPLY_MARKET_RESEARCH,
        TCPurpose.DEVELOP_IMPROVE_PRODUCTS
      ].every(
        purposeId =>
          tcData.purpose.consents[purposeId] || tcData.purpose.legitimateInterests[purposeId]
      ))
  );
};

export const gptInit = (assetLoader: IAssetLoaderService): InitStep => {
  let result: Promise<void>;
  return mkInitStep('gpt-init', (context: AdPipelineContext) => {
    if (context.env === 'test') {
      return Promise.resolve();
    }
    if (!result) {
      result = new Promise<void>(resolve => {
        context.logger.debug('GAM', 'init googletag stub');
        // These are two separate steps to fix race conditions, when window.googletag is set for unknown reasons,
        // but window.googletag.cmd is not. The thesis is that gpt.js is loading before `cmd` is set, but doesn't provide
        // it by itself.
        context.window.googletag = context.window.googletag || ({} as any);
        context.window.googletag.cmd = context.window.googletag.cmd || [];
        context.window.googletag.cmd.push(resolve);

        assetLoader
          .loadScript({
            name: 'gpt',
            loadMethod: AssetLoadMethod.TAG,
            assetUrl: useStandardGpt(context.tcData, context.config.consent)
              ? 'https://securepubads.g.doubleclick.net/tag/js/gpt.js'
              : 'https://pagead2.googlesyndication.com/tag/js/gpt.js'
          })
          .catch(error => context.logger.error('failed to load gpt.js', error));
      });
    }
    return result;
  });
};

/**
 * Destroy slots before anything. This step is required for single page applications to ensure a fresh setup.
 *
 * This step is run once per request ads cycle by default. This can be changed by setting the `spa.destroyAllAdSlots` setting
 * to `false`. In this case the slots provided in the slot array are destroyed during the ad pipeline run.
 */
export const gptDestroyAdSlots = (): ConfigureStep => {
  // mimic the mkConfigureStepOncePerRequestAdsCycle behaviour. Depending on the spa.destroyAllAdSlots setting
  // we either destroy all slots once or only the slots provided in the slot array, but with every pipeline run
  let currentRequestAdsCalls = 0;

  return mkConfigureStep('gpt-destroy-ad-slots', (context, slots) => {
    if (context.env === 'test') {
      return Promise.resolve();
    }
    const cleanup = context.config.spa?.cleanup ?? { slots: 'all' };

    const destroySelectedSlots = (slots: googletag.IAdSlot[]): Promise<void> => {
      if (slots.length === 0) {
        context.logger.debug('GAM', 'no ad slots to destroy');
        return Promise.resolve();
      }
      context.logger.debug('GAM', `destroy ${slots.length} ad slots`, slots);
      context.window.googletag.destroySlots(slots);
      return Promise.resolve();
    };
    const isNextRequestAdsCall = currentRequestAdsCalls !== context.requestAdsCalls;
    currentRequestAdsCalls = context.requestAdsCalls;

    context.logger.debug('GAM', `destroy ${cleanup.slots} ad slots`);
    switch (cleanup.slots) {
      case 'all':
        if (isNextRequestAdsCall) {
          context.window.googletag.destroySlots();
        }
        return Promise.resolve();
      case 'requested':
        const allGptSlots = context.window.googletag.pubads().getSlots();
        const gptSlots = slots
          .map(slot => allGptSlots.find(s => s.getSlotElementId() === slot.domId))
          .filter(isNotNull);
        // destroy all slots that are in the provided slot array
        return destroySelectedSlots(gptSlots);
      case 'excluded':
        if (isNextRequestAdsCall) {
          // destroy all slots that are not in the provided slot array
          const destroyableSlots = context.window.googletag
            .pubads()
            .getSlots()
            .filter(slot => !cleanup.slotIds.includes(slot.getSlotElementId()));
          return destroySelectedSlots(destroyableSlots);
        }
        return Promise.resolve();
    }
  });
};

/**
 * Reset the gpt targeting configuration (key-values) and uses the targeting information from
 * the given config to set new key values.
 *
 * This method is required for the single-page-application mode to make sure we don't send
 * stale key-values
 *
 */
export const gptResetTargeting = (): ConfigureStep =>
  mkConfigureStepOncePerRequestAdsCycle(
    'gpt-reset-targeting',
    (context: AdPipelineContext) =>
      new Promise<void>(resolve => {
        if (context.env === 'production') {
          context.logger.debug('GAM', 'reset top level targeting');
          context.window.googletag.pubads().clearTargeting();
          configureTargeting(context.window, context.config.targeting);
        }

        resolve();
      })
  );

export const gptConfigure = (config: Moli.MoliConfig): ConfigureStep => {
  let result: Promise<void>;
  return mkConfigureStep('gpt-configure', (context: AdPipelineContext, _slots: Moli.AdSlot[]) => {
    if (!result) {
      result = new Promise<void>(resolve => {
        const env = config.environment || 'production';
        context.logger.debug('GAM', 'configure googletag');
        switch (env) {
          case 'production':
            configureTargeting(context.window, config.targeting);

            context.window.googletag.pubads().enableAsyncRendering();
            context.window.googletag.pubads().disableInitialLoad();
            context.window.googletag.pubads().enableSingleRequest();

            if (context.config.gpt?.pageSettingsConfig) {
              context.window.googletag.setConfig(context.config.gpt.pageSettingsConfig);
            }

            const limitedAds = !useStandardGpt(context.tcData, context.config.consent);
            context.logger.debug('GAM', `use limited ads`, limitedAds);

            context.window.googletag.pubads().setPrivacySettings({
              limitedAds
              // TODO what about restrict data processing?
            });

            context.window.googletag.enableServices();
            resolve();
            return;
          case 'test':
            resolve();
            return;
        }
      });
    }
    return result;
  });
};

/**
 * Adds a key-value `deviceLabel` to the targeting if a single device label could be found.
 * A valid device label is `mobile`, `tablet` and `desktop`.
 *
 * The `LabelConfigService` is used to fetch the supported labels.
 */
export const gptLDeviceLabelKeyValue = (): PrepareRequestAdsStep =>
  mkPrepareRequestAdsStep('gpt-device-label-keyValue', LOW_PRIORITY, ctx => {
    if (ctx.env === 'test') {
      return Promise.resolve();
    }
    return new Promise<void>(resolve => {
      const deviceLabel = ctx.labelConfigService.getDeviceLabel();
      ctx.logger.debug('GAM', 'adding "device_label" key-value with values', deviceLabel);
      ctx.window.googletag.pubads().setTargeting('device_label', deviceLabel);

      resolve();
    });
  });

/**
 * Sets a `consent` key value depending on the user consent
 *
 * - if all purposes are accepted `full`
 * - if any purposes is rejected `none`
 */
export const gptConsentKeyValue = (): PrepareRequestAdsStep =>
  mkPrepareRequestAdsStep('gpt-consent-keyValue', LOW_PRIORITY, ctx => {
    if (ctx.env === 'test') {
      return Promise.resolve();
    }
    return new Promise(resolve => {
      const tcData = ctx.tcData;
      // set consent key value
      const fullConsent =
        !tcData.gdprApplies ||
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
        ].every(purpose => tcData.purpose.consents[purpose]);
      ctx.window.googletag.pubads().setTargeting('consent', fullConsent ? 'full' : 'none');
      resolve();
    });
  });

export const gptDefineSlots =
  (): DefineSlotsStep => (context: AdPipelineContext, slots: Moli.AdSlot[]) => {
    const slotDefinitions = slots.map(moliSlot => {
      const sizeConfigService = new SizeConfigService(
        moliSlot.sizeConfig,
        context.labelConfigService.getSupportedLabels(),
        context.window
      );
      const filterSupportedSizes = sizeConfigService.filterSupportedSizes;

      // filter slots that shouldn't be displayed
      if (
        !(sizeConfigService.filterSlot(moliSlot) && context.labelConfigService.filterSlot(moliSlot))
      ) {
        return Promise.resolve(null);
      }

      const sizes = filterSupportedSizes(moliSlot.sizes);

      const resolvedAdUnitPath = resolveAdUnitPath(
        moliSlot.adUnitPath,
        context.adUnitPathVariables
      );

      const createDivIfMissing = (domId: string) => {
        if (!context.window.document.getElementById(domId)) {
          // if there's no element in the DOM, we create a div element with the given id to
          // ensure a proper prebid auction can be executed
          const slot = context.window.document.createElement('div');
          slot.id = domId;
          slot.setAttribute('data-h5v-position', moliSlot.position);
          slot.style.setProperty('display', 'none'); // should not be visible
          context.window.document.body.appendChild(slot);
        }
      };

      // define an ad slot depending on the `position` parameter
      const defineAdSlot = (): [
        googletag.IAdSlot | null,
        googletag.enums.OutOfPageFormat | null
      ] => {
        switch (moliSlot.position) {
          case 'in-page':
            return [
              context.window.googletag.defineSlot(resolvedAdUnitPath, sizes, moliSlot.domId),
              null
            ];
          case 'interstitial':
            // note that the interstitial position first requests prebid demand and if none, switches
            // to the out-of-page-interstitial position if there are no bids or low quality bids
            createDivIfMissing(moliSlot.domId);

            switch (context.auction.interstitialChannel()) {
              case 'gam':
                return [
                  context.window.googletag.defineOutOfPageSlot(
                    resolvedAdUnitPath,
                    context.window.googletag.enums.OutOfPageFormat.INTERSTITIAL
                  ),
                  context.window.googletag.enums.OutOfPageFormat.INTERSTITIAL
                ];
              // if the interstitial channel is not gam, we use the in-page position and treat it
              // like a regular ad slot.
              case 'c':
              default:
                return [
                  context.window.googletag.defineSlot(resolvedAdUnitPath, sizes, moliSlot.domId),
                  null
                ];
            }
          case 'out-of-page':
            return [
              context.window.googletag.defineOutOfPageSlot(resolvedAdUnitPath, moliSlot.domId),
              null
            ];
          case 'out-of-page-interstitial':
            return [
              context.window.googletag.defineOutOfPageSlot(
                resolvedAdUnitPath,
                context.window.googletag.enums.OutOfPageFormat.INTERSTITIAL
              ),
              context.window.googletag.enums.OutOfPageFormat.INTERSTITIAL
            ];
          case 'out-of-page-bottom-anchor':
            return [
              context.window.googletag.defineOutOfPageSlot(
                resolvedAdUnitPath,
                context.window.googletag.enums.OutOfPageFormat.BOTTOM_ANCHOR
              ),
              context.window.googletag.enums.OutOfPageFormat.BOTTOM_ANCHOR
            ];
          case 'out-of-page-top-anchor':
            return [
              context.window.googletag.defineOutOfPageSlot(
                resolvedAdUnitPath,
                context.window.googletag.enums.OutOfPageFormat.TOP_ANCHOR
              ),
              context.window.googletag.enums.OutOfPageFormat.TOP_ANCHOR
            ];
        }
      };

      // ensures that an ad slot is only displayed once
      const defineAndDisplayAdSlot = (): googletag.IAdSlot | null => {
        // do not define and display ad slots in test mode to avoid spurious errors when refreshing ad slots
        if (context.env === 'test') {
          return null;
        }
        const [adSlot, format] = defineAdSlot();
        if (adSlot) {
          // transport the special GAM formats through the ad slot targeting
          if (format) {
            adSlot.setTargeting(formatKey, format.toString());
          } else {
            adSlot.clearTargeting(formatKey);
          }
          // required method call, but doesn't trigger ad loading as we use the disableInitialLoad
          context.window.googletag.display(adSlot);
        }
        return adSlot;
      };

      // lookup existing slots and use those if already present. This makes defineSlots idempotent
      // in test mode we only return an empty array as googletag is not defined
      const allSlots = context.env === 'test' ? [] : context.window.googletag.pubads().getSlots();
      const existingSlot = allSlots.find(s => s.getSlotElementId() === moliSlot.domId);

      // define and display ad slot if doesn't exist yet
      const adSlot: googletag.IAdSlot | null = existingSlot
        ? existingSlot
        : defineAndDisplayAdSlot();

      switch (context.env) {
        case 'production':
          if (adSlot) {
            if (moliSlot.gpt) {
              adSlot.setConfig(moliSlot.gpt);
              context.logger.debug(
                'GAM',
                `Add slot settings: [AdSlot] ${adSlot} [Settings] ${moliSlot.gpt}`
              );
            }
            adSlot.setCollapseEmptyDiv(moliSlot.gpt?.collapseEmptyDiv !== false);
            adSlot.addService(context.window.googletag.pubads());
            context.logger.debug(
              'GAM',
              `Register slot: [DomID] ${moliSlot.domId} [AdUnitPath] ${moliSlot.adUnitPath}`
            );
            return Promise.resolve<SlotDefinition>({ moliSlot, adSlot, filterSupportedSizes });
          } else if (
            moliSlot.position === 'out-of-page-interstitial' ||
            moliSlot.position === 'out-of-page-top-anchor' ||
            moliSlot.position === 'out-of-page-bottom-anchor'
          ) {
            context.logger.warn('GAM', `${moliSlot.position} is not supported`);
            return Promise.resolve(null);
          } else {
            const error = `Slot: [DomID] ${moliSlot.domId} [AdUnitPath] ${moliSlot.adUnitPath} is already defined. You may have called requestAds() multiple times`;
            context.logger.error('GAM', error);
            return Promise.reject(new Error(error));
          }
        case 'test':
          return Promise.resolve<SlotDefinition>({
            moliSlot,
            adSlot: testAdSlot(moliSlot.domId, moliSlot.adUnitPath),
            filterSupportedSizes
          });
        default:
          return Promise.reject(`invalid environment: ${context.config.environment}`);
      }
    });

    return Promise.all(slotDefinitions).then(slots => slots.filter(isNotNull));
  };

/**
 * check demand of interstitial position and remap to google ad manager web interstitial
 * if there are no bids.
 *
 * @param slotsToRefresh the list of slots that are currently in the auction
 * @param context ad pipeline context to access googletag, logger and window
 */
const checkAndSwitchToWebInterstitial = (
  slotsToRefresh: SlotDefinition[],
  context: AdPipelineContext
) => {
  // check demand of interstitial position and remap if there are no bids
  const interstitialSlot = slotsToRefresh.find(
    ({ moliSlot }) => moliSlot.position === 'interstitial'
  );

  if (interstitialSlot && context.auction.interstitialChannel() === 'gam') {
    // if there are no bids, we switch to the out-of-page-interstitial position
    context.window.googletag.destroySlots([interstitialSlot.adSlot]);

    const gamWebInterstitial = context.window.googletag.defineOutOfPageSlot(
      resolveAdUnitPath(interstitialSlot.moliSlot.adUnitPath, context.adUnitPathVariables),
      context.window.googletag.enums.OutOfPageFormat.INTERSTITIAL
    );
    if (gamWebInterstitial) {
      context.logger.debug('GAM', 'Display out-of-page-interstitial slot');

      // this little dance is annoying - refresh is done afterwards
      gamWebInterstitial.addService(context.window.googletag.pubads());
      gamWebInterstitial.setTargeting(
        formatKey,
        context.window.googletag.enums.OutOfPageFormat.INTERSTITIAL.toString()
      );

      context.window.googletag.display(gamWebInterstitial);

      // early return to swap the interstitial slot
      return [
        ...slotsToRefresh.filter(({ moliSlot }) => moliSlot.position !== 'interstitial'),
        { ...interstitialSlot, adSlot: gamWebInterstitial }
      ];
    } else {
      context.logger.error('GAM', 'Failed to define out-of-page-interstitial slot');
    }
  }

  return slotsToRefresh;
};

export const gptRequestAds =
  (): RequestAdsStep => (context: AdPipelineContext, slots: SlotDefinition[]) =>
    new Promise<void>(resolve => {
      context.logger.debug('GAM', 'requestAds');
      switch (context.env) {
        case 'test':
          createTestSlots(context, slots);
          break;
        case 'production':
          const slotsToRefresh = slots.filter(
            ({ adSlot }) => !context.auction.isSlotThrottled(adSlot)
          );
          if (slotsToRefresh.length === 0) {
            break;
          }
          // check demand of interstitial position and remap if there are no bids
          const updatedSlots = checkAndSwitchToWebInterstitial(slotsToRefresh, context);

          // load ads
          context.window.googletag.pubads().refresh(updatedSlots.map(({ adSlot }) => adSlot));

          // debug logs
          const debugMessage = updatedSlots
            .map(({ moliSlot }) => `[DomID] ${moliSlot.domId} [AdUnitPath] ${moliSlot.adUnitPath}`)
            .join('\n');
          context.logger.debug('GAM', `Refresh ${slots.length} slot(s):\n${debugMessage}`);

          break;
      }

      resolve();
    });
