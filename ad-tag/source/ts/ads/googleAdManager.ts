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
import IGoogleTag = googletag.IGoogleTag;
import TCPurpose = tcfapi.responses.TCPurpose;
import { resolveAdUnitPath } from './adUnitPath';

/**
 * A dummy googletag ad slot for the test mode
 * @param domId
 * @param adUnitPath
 */
const testAdSlot = (domId: string, adUnitPath: string): googletag.IAdSlot => ({
  setCollapseEmptyDiv(): void {
    return;
  },
  addService(service: googletag.IService<any>): void {
    return;
  },

  getSlotElementId(): string {
    return domId;
  },

  getAdUnitPath(): string {
    return adUnitPath;
  },

  setTargeting(key: string, value: string | string[]): googletag.IAdSlot {
    return this;
  },

  getTargeting(key: string): string[] {
    return [];
  },

  getTargetingKeys(): string[] {
    return [];
  },

  clearTargeting(key?: string): void {
    return;
  },
  getResponseInformation(): null | googletag.IResponseInformation {
    return null;
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
const useStandardGpt = (tcData: tcfapi.responses.TCData): boolean => {
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
            assetUrl: useStandardGpt(context.tcData)
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
 * This step is run once per request ads cycle. An alternative implementation could delete google slots y for the ad
 * slots provided in the slot array. However this keeps old slots lingering around, which we surely don't want.
 */
export const gptDestroyAdSlots = (): ConfigureStep =>
  mkConfigureStepOncePerRequestAdsCycle(
    'gpt-destroy-ad-slots',
    (context: AdPipelineContext) =>
      new Promise<void>(resolve => {
        context.logger.debug('GAM', 'destroy all ad slots');
        context.window.googletag.destroySlots();
        resolve();
      })
  );

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

            const limitedAds = !useStandardGpt(context.tcData);
            context.logger.debug('GAM', `use limited ads`, limitedAds);

            context.window.googletag.pubads().setPrivacySettings({
              limitedAds
              // TODO what about restrict data processing?
            });

            context.window.googletag.enableServices();
            resolve();
            return;
          case 'test':
            context.window.googletag.enableServices();
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
  mkPrepareRequestAdsStep(
    'gpt-device-label-keyValue',
    LOW_PRIORITY,
    ctx =>
      new Promise<void>(resolve => {
        const deviceLabel = ctx.labelConfigService.getDeviceLabel();
        ctx.logger.debug('GAM', 'adding "device_label" key-value with values', deviceLabel);
        ctx.window.googletag.pubads().setTargeting('device_label', deviceLabel);

        resolve();
      })
  );

/**
 * Sets a `consent` key value depending on the user consent
 *
 * - if all purposes are accepted `full`
 * - if any purposes is rejected `none`
 */
export const gptConsentKeyValue = (): PrepareRequestAdsStep =>
  mkPrepareRequestAdsStep(
    'gpt-consent-keyValue',
    LOW_PRIORITY,
    ctx =>
      new Promise(resolve => {
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
      })
  );

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

      // define an ad slot depending on the `position` parameter
      const defineAdSlot = (): googletag.IAdSlot | null => {
        switch (moliSlot.position) {
          case 'in-page':
            return context.window.googletag.defineSlot(resolvedAdUnitPath, sizes, moliSlot.domId);
          case 'out-of-page':
            return context.window.googletag.defineOutOfPageSlot(resolvedAdUnitPath, moliSlot.domId);
          case 'out-of-page-interstitial':
            context.logger.debug('GAM', `defined web interstitial for ${resolvedAdUnitPath}`);
            return context.window.googletag.defineOutOfPageSlot(
              resolvedAdUnitPath,
              context.window.googletag.enums.OutOfPageFormat.INTERSTITIAL
            );
          case 'out-of-page-bottom-anchor':
            context.logger.debug('GAM', `defined bottom anchor for ${resolvedAdUnitPath}`);
            return context.window.googletag.defineOutOfPageSlot(
              resolvedAdUnitPath,
              context.window.googletag.enums.OutOfPageFormat.BOTTOM_ANCHOR
            );
          case 'out-of-page-top-anchor':
            context.logger.debug('GAM', `defined top anchor for ${resolvedAdUnitPath}`);
            return context.window.googletag.defineOutOfPageSlot(
              resolvedAdUnitPath,
              context.window.googletag.enums.OutOfPageFormat.TOP_ANCHOR
            );
        }
      };

      // ensures that an ad slot is only displayed once
      const defineAndDisplayAdSlot = (): googletag.IAdSlot | null => {
        // do not define and display ad slots in test mode to avoid spurious errors when refreshing ad slots
        if (context.env === 'test') {
          return null;
        }
        const adSlot = defineAdSlot();
        if (adSlot) {
          // required method call, but doesn't trigger ad loading as we use the disableInitialLoad
          context.window.googletag.display(adSlot);
        }
        return adSlot;
      };

      // lookup existing slots and use those if already present. This makes defineSlots idempotent
      const allSlots = context.window.googletag.pubads().getSlots();
      const existingSlot = allSlots.find(s => s.getSlotElementId() === moliSlot.domId);

      // define and display ad slot if doesn't exist yet
      const adSlot: googletag.IAdSlot | null = existingSlot
        ? existingSlot
        : defineAndDisplayAdSlot();

      switch (context.env) {
        case 'production':
          if (adSlot) {
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

export const gptRequestAds =
  (): RequestAdsStep => (context: AdPipelineContext, slots: SlotDefinition[]) =>
    new Promise<void>(resolve => {
      context.logger.debug('GAM', 'requestAds');
      switch (context.env) {
        case 'test':
          createTestSlots(context, slots);
          break;
        case 'production':
          // load ads
          context.window.googletag.pubads().refresh(slots.map(slot => slot.adSlot));
          // mark slots as refreshed
          slots.forEach(({ moliSlot }) => context.reportingService.markRefreshed(moliSlot));

          // debug logs
          const debugMessage = slots
            .map(({ moliSlot }) => `[DomID] ${moliSlot.domId} [AdUnitPath] ${moliSlot.adUnitPath}`)
            .join('\n');
          context.logger.debug('GAM', `Refresh ${slots.length} slot(s):\n${debugMessage}`);

          break;
      }

      resolve();
    });
