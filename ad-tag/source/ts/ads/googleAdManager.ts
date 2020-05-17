import {
  AdPipelineContext,
  ConfigureStep,
  DefineSlotsStep,
  InitStep,
  mkConfigureStep,
  mkInitStep,
  RequestAdsStep
} from './adPipeline';
import { Moli } from '../types/moli';
import SlotDefinition = Moli.SlotDefinition;
import { SizeConfigService } from './sizeConfigService';
import { googletag } from '../types/googletag';
import { isNotNull } from '../util/arrayUtils';

const configureTargeting = (window: Window, targeting: Moli.Targeting | undefined, env: Moli.Environment): void => {
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

export const gptInit = (): InitStep => {
  let result: Promise<void>;
  return mkInitStep('gpt-init', (context: AdPipelineContext) => {
    if (!result) {
      result = new Promise<void>(resolve => {
        context.logger.debug('GAM', 'init googletag stub');
        context.window.googletag = context.window.googletag || { cmd: [] };
        context.window.googletag.cmd.push(resolve);
      });
    }
    return result;
  });
};

/**
 * Destroy slots before anything. This step is required for single page applications to ensure
 * a fresh setup
 */
export const gptDestroyAdSlots = (): ConfigureStep => mkConfigureStep('gpt-destroy-ad-slots', (context: AdPipelineContext) => new Promise<void>(resolve => {
  context.logger.debug('GAM', 'destroy all ad slots');
  context.slotEventService.removeAllEventSources(context.window);
  context.window.googletag.destroySlots();
  resolve();
}));

/**
 * Reset the gpt targeting configuration (key-values) and uses the targeting information from
 * the given config to set new key values.
 *
 * This method is required for the single-page-application mode to make sure we don't send
 * stale key-values
 *
 * @param config
 */
export const gptResetTargeting = (): ConfigureStep => mkConfigureStep('gpt-reset-targeting', (context: AdPipelineContext) => new Promise<void>(resolve => {
  if (context.env === 'production') {
    context.logger.debug('GAM', 'reset top level targeting');
    context.window.googletag.pubads().clearTargeting();
    configureTargeting(context.window, context.config.targeting, context.env);
  }

  resolve();
}));

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

export const gptDefineSlots = (): DefineSlotsStep => (context: AdPipelineContext, slots: Moli.AdSlot[]) => {
  const slotDefinitions = slots.map(moliSlot => {
    const sizeConfigService = new SizeConfigService(moliSlot.sizeConfig, context.window);
    const filterSupportedSizes = sizeConfigService.filterSupportedSizes;

    // filter slots that shouldn't be displayed
    if (!(sizeConfigService.filterSlot(moliSlot) && context.labelConfigService.filterSlot(moliSlot))) {
      return Promise.resolve(null);
    }

    const sizes = filterSupportedSizes(moliSlot.sizes);

    // lookup existing slots and use those if already present. This makes defineSlots idempotent
    const allSlots = context.env === 'production'
      ? context.window.googletag.pubads().getSlots()
      : context.window.googletag.content().getSlots();
    const existingSlot = allSlots.find(s => s.getSlotElementId() === moliSlot.domId);
    const adSlot: googletag.IAdSlot | null = existingSlot ? existingSlot : (moliSlot.position === 'in-page' ?
        context.window.googletag.defineSlot(moliSlot.adUnitPath, sizes, moliSlot.domId) :
        context.window.googletag.defineOutOfPageSlot(moliSlot.adUnitPath, moliSlot.domId)
    );

    if (adSlot) {
      adSlot.setCollapseEmptyDiv(true);

      // required method call, but doesn't trigger ad loading as we use the disableInitialLoad
      context.window.googletag.display(adSlot.getSlotElementId());
      switch (context.env) {
        case 'production':
          adSlot.addService(context.window.googletag.pubads());
          context.logger.debug('GAM', `Register slot: [DomID] ${moliSlot.domId} [AdUnitPath] ${moliSlot.adUnitPath}`);
          return Promise.resolve<SlotDefinition>({ moliSlot, adSlot, filterSupportedSizes });
        case 'test':
          context.logger.warn('GAM', `Enabling content service on ${adSlot.getSlotElementId()}`);
          adSlot.addService(context.window.googletag.content());
          return Promise.resolve<SlotDefinition>({ moliSlot, adSlot, filterSupportedSizes });
        default:
          return Promise.reject(`invalid environment: ${context.config.environment}`);
      }
    } else {
      const error = `Slot: [DomID] ${moliSlot.domId} [AdUnitPath] ${moliSlot.adUnitPath} is already defined. You may have called requestAds() multiple times`;
      context.logger.error('GAM', error);
      return Promise.reject(new Error(error));
    }

  });

  return Promise.all(slotDefinitions).then(slots => slots.filter(isNotNull));
};

export const gptRequestAds = (): RequestAdsStep => (context: AdPipelineContext, slots: SlotDefinition[]) => new Promise<void>(resolve => {
  context.logger.debug('GAM', 'requestAds');
  switch (context.env) {
    case 'test':
      slots.forEach(({ adSlot, moliSlot, filterSupportedSizes }) => {
        const containerId = `${moliSlot.domId}__container`;
        const containerWidthId = `${moliSlot.domId}__container_width`;
        const containerHeightId = `${moliSlot.domId}__container_height`;

        // pick a random, fixed sizes
        const sizes = filterSupportedSizes(moliSlot.sizes)
          // no fluid sizes
          .filter(SizeConfigService.isFixedSize)
          // no 1x1 sizes
          .filter(([ width, height ]) => width > 1 && height > 1);
        const rnd = Math.floor(Math.random() * 20) + 1;
        const index = (sizes.length - 1) % rnd;

        // there is room for improvement. We should differentiate between only fluid, only 1x1
        const [ width, height ] = sizes.length === 0 ? [ 300, 250 ] : sizes[index];

        const buttons = sizes.map(([ width, height ]) => {
          const resize = `(function(){
              var container = document.getElementById('${containerId}');
              container.style.width = '${width}px';
              container.style.height = '${height}px';
              document.getElementById('${containerWidthId}').textContent = ${width};;
              document.getElementById('${containerHeightId}').textContent = ${height};;
            })()`;
          return `<button onclick="${resize}" style="font-size: 10px; background: #00a4a6; color: white; border: 1px dotted white;">${width}x${height}</button>`;
        }).join('\n');

        // CSS Pattern from https://leaverou.github.io/css3patterns/#lined-paper
        const html = `<div id="${containerId}"
                             style="position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center;
                             width: ${width}px; height: ${height}px; padding: 6px; border: 2px dotted gray;
                             background-color: #fff;
                             background-image:
                             linear-gradient(90deg, transparent 79px, #abced4 79px, #abced4 81px, transparent 81px),
                             linear-gradient(#eee .1em, transparent .1em);
                             background-size: 100% 1.2em;
                             ">
<div style="position: absolute; top: 5px; left: 5px">${buttons}</div>        
<div><h4><strong id="${containerWidthId}">${width}</strong>x<strong id="${containerHeightId}">${height}</strong> pixel</h4></div>
</div>`;

        context.window.googletag.content().setContent(adSlot, html);
        context.logger.debug('GAM', `Set content for slot: [DomID] ${moliSlot.domId} [AdUnitPath] ${moliSlot.adUnitPath}`);
      });
      break;
    case 'production':
      // clear targetings for each slot before refreshing
      context.window.googletag.pubads().refresh(slots.map(slot => slot.adSlot));
      slots.forEach(slot => {
        context.logger.debug('GAM', `Refresh slot: [DomID] ${slot.moliSlot.domId} [AdUnitPath] ${slot.moliSlot.adUnitPath}`);
        context.reportingService.markRefreshed(slot.moliSlot);
      });
      break;
  }

  resolve();
});
