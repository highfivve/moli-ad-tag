import {
  AdPipelineContext,
  ConfigureStep,
  DefineSlotsStep,
  InitStep,
  mkConfigureStep,
  mkConfigureStepOncePerRequestAdsCycle,
  mkInitStep,
  RequestAdsStep
} from './adPipeline';
import { Moli } from '../types/moli';
import { SizeConfigService } from './sizeConfigService';
import { googletag } from '../types/googletag';
import { isNotNull } from '../util/arrayUtils';
import { AssetLoadMethod, IAssetLoaderService } from '../util/assetLoaderService';
import SlotDefinition = Moli.SlotDefinition;
import { tcfapi } from '../types/tcfapi';
import IGoogleTag = googletag.IGoogleTag;
import { createBlankTestSlots, fillTestSlots } from '../util/test-slots';

const configureTargeting = (
  window: Window & googletag.IGoogleTagWindow,
  targeting: Moli.Targeting | undefined,
  env: Moli.Environment
): void => {
  if (env === 'production') {
    const keyValueMap = targeting ? targeting.keyValues : {};
    Object.keys(keyValueMap).forEach(key => {
      const value = keyValueMap[key];
      if (value) {
        window.googletag.pubads().setTargeting(key, value);
      }
    });
  }
};

/**
 * This is a temporary workaround until gpt.js understands the tcfapi
 * @see https://support.google.com/admanager/answer/9805023
 */
const useStandardGpt = (tcData: tcfapi.responses.TCData): boolean => {
  return (
    tcData.vendor.consents[755] &&
    tcData.purpose.consents[1] &&
    [2, 7, 9, 10].every(
      purposeId =>
        tcData.purpose.consents[purposeId] || tcData.purpose.legitimateInterests[purposeId]
    )
  );
};

export const gptInit = (assetLoader: IAssetLoaderService): InitStep => {
  let result: Promise<void>;
  return mkInitStep('gpt-init', (context: AdPipelineContext) => {
    if (!result) {
      result = new Promise<void>(resolve => {
        context.logger.debug('GAM', 'init googletag stub');
        context.window.googletag =
          context.window.googletag || (({ cmd: [] } as unknown) as IGoogleTag);
        context.window.googletag.cmd.push(resolve);

        assetLoader.loadScript({
          name: 'gpt',
          loadMethod: AssetLoadMethod.TAG,
          assetUrl: useStandardGpt(context.tcData)
            ? 'https://securepubads.g.doubleclick.net/tag/js/gpt.js'
            : 'https://pagead2.googlesyndication.com/tag/js/gpt.js'
        });
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
 * @param config
 */
export const gptResetTargeting = (): ConfigureStep =>
  mkConfigureStepOncePerRequestAdsCycle(
    'gpt-reset-targeting',
    (context: AdPipelineContext) =>
      new Promise<void>(resolve => {
        if (context.env === 'production') {
          context.logger.debug('GAM', 'reset top level targeting');
          context.window.googletag.pubads().clearTargeting();
          configureTargeting(context.window, context.config.targeting, context.env);
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
            configureTargeting(context.window, config.targeting, env);

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
            // Note that this call is actually important to initialize the content service. Otherwise
            // the service won't be enabled with the `googletag.enableServices()`.
            context.window.googletag.content().getSlots();
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
 *
 */
export const gptLDeviceLabelKeyValue = (): ConfigureStep =>
  mkConfigureStepOncePerRequestAdsCycle(
    'gpt-device-label-keyValue',
    ctx =>
      new Promise<void>(resolve => {
        const whitelist = ['mobile', 'tablet', 'desktop'];
        const deviceLabels = ctx.labelConfigService
          .getSupportedLabels()
          .filter(label => whitelist.some(deviceLabel => deviceLabel === label));

        if (deviceLabels.length === 1) {
          ctx.logger.debug('GAM', 'adding "device_label" key-value with values', deviceLabels);
          ctx.window.googletag.pubads().setTargeting('device_label', deviceLabels);
        } else {
          ctx.logger.warn(
            'GAM',
            `Expected one device label, but found ${deviceLabels.length}`,
            deviceLabels
          );
        }

        resolve();
      })
  );

export const gptDefineSlots = (): DefineSlotsStep => (
  context: AdPipelineContext,
  slots: Moli.AdSlot[]
) => {
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

    // define an ad slot depending on the `position` parameter
    const defineAdSlot = (): googletag.IAdSlot | null => {
      switch (moliSlot.position) {
        case 'in-page':
          return context.window.googletag.defineSlot(moliSlot.adUnitPath, sizes, moliSlot.domId);
        case 'out-of-page':
          return context.window.googletag.defineOutOfPageSlot(moliSlot.adUnitPath, moliSlot.domId);
        case 'out-of-page-interstitial':
          context.logger.debug('GAM', `defined web interstitial for ${moliSlot.adUnitPath}`);
          return context.window.googletag.defineOutOfPageSlot(
            moliSlot.adUnitPath,
            context.window.googletag.enums.OutOfPageFormat.INTERSTITIAL
          );
      }
    };

    // ensures that an ad slot is only displayed once
    const defineAndDisplayAdSlot = (): googletag.IAdSlot | null => {
      const adSlot = defineAdSlot();
      if (adSlot) {
        // required method call, but doesn't trigger ad loading as we use the disableInitialLoad
        context.window.googletag.display(adSlot);
      }
      return adSlot;
    };

    // lookup existing slots and use those if already present. This makes defineSlots idempotent
    const allSlots =
      context.env === 'production'
        ? context.window.googletag.pubads().getSlots()
        : context.window.googletag.content().getSlots();
    const existingSlot = allSlots.find(s => s.getSlotElementId() === moliSlot.domId);

    // define and display ad slot if doesn't exist yet
    const adSlot: googletag.IAdSlot | null = existingSlot ? existingSlot : defineAndDisplayAdSlot();

    if (adSlot) {
      adSlot.setCollapseEmptyDiv(true);

      switch (context.env) {
        case 'production':
          adSlot.addService(context.window.googletag.pubads());
          context.logger.debug(
            'GAM',
            `Register slot: [DomID] ${moliSlot.domId} [AdUnitPath] ${moliSlot.adUnitPath}`
          );
          return Promise.resolve<SlotDefinition>({ moliSlot, adSlot, filterSupportedSizes });
        case 'test':
          context.logger.warn('GAM', `Enabling content service on ${adSlot.getSlotElementId()}`);
          adSlot.addService(context.window.googletag.content());
          return Promise.resolve<SlotDefinition>({ moliSlot, adSlot, filterSupportedSizes });
        default:
          return Promise.reject(`invalid environment: ${context.config.environment}`);
      }
    } else if (moliSlot.position === 'out-of-page-interstitial') {
      context.logger.warn('GAM', 'web interstitial is not supported');
      return Promise.resolve(null);
    } else {
      const error = `Slot: [DomID] ${moliSlot.domId} [AdUnitPath] ${moliSlot.adUnitPath} is already defined. You may have called requestAds() multiple times`;
      context.logger.error('GAM', error);
      return Promise.reject(new Error(error));
    }
  });

  return Promise.all(slotDefinitions).then(slots => slots.filter(isNotNull));
};

export const gptRequestAds = (): RequestAdsStep => (
  context: AdPipelineContext,
  slots: SlotDefinition[]
) =>
  new Promise<void>(resolve => {
    context.logger.debug('GAM', 'requestAds');
    switch (context.env) {
      case 'test':
        fillTestSlots(createBlankTestSlots(context, slots));
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
