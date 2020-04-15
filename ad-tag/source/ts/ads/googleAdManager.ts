import { ConfigureStep, DefineSlotsStep, InitStep, RequestAdsStep } from './adPipeline';
import { Moli } from '../types/moli';
import SlotDefinition = Moli.SlotDefinition;
import { SizeConfigService } from './sizeConfigService';
import { googletag } from '../types/googletag';
import { ReportingService } from './reportingService';

/**
 * Decides which sizeConfigService to use - if the slot brings its own sizeConfig, it gets precedence over the
 * global one.
 *
 * @param moliSlot the ad slot
 */
const getSizeFilterFunction = (window: Window, moliSlot: Moli.AdSlot): Moli.FilterSupportedSizes => {
  return (givenSizes: Moli.DfpSlotSize[]) => new SizeConfigService(moliSlot.sizeConfig, window).filterSupportedSizes(givenSizes);
};

const configureTargeting = (targeting: Moli.Targeting | undefined, env: Moli.Environment): void => {
  switch (env) {
    case 'production':
      const keyValueMap = targeting ? targeting.keyValues : {};
      Object.keys(keyValueMap).forEach(key => {
        const value = keyValueMap[key];
        if (value) {
          window.googletag.pubads().setTargeting(key, value);
        }
      });
      return;
    case 'test':
      return;
  }
};

export const gptInit = (window: Window): InitStep => () => new Promise<void>(resolve => {
  window.googletag = window.googletag || { cmd: [] };
  window.googletag.cmd.push(resolve);
});

export const gptConfigure = (window: Window, config: Moli.MoliConfig, logger: Moli.MoliLogger): ConfigureStep => (slots: Moli.AdSlot[]) => new Promise<void>(resolve => {
  const env = config.environment || 'production';
  switch (env) {
    case 'production':
      configureTargeting(config.targeting, env);

      window.googletag.pubads().enableAsyncRendering();
      window.googletag.pubads().disableInitialLoad();
      window.googletag.pubads().enableSingleRequest();

      window.googletag.enableServices();
      return Promise.resolve();
    case 'test':
      // Note that this call is actually important to initialize the content service. Otherwise
      // the service won't be enabled with the `googletag.enableServices()`.
      window.googletag.content().getSlots();
      window.googletag.enableServices();
      return Promise.resolve();
  }
});

export const gptDefineSlots = (window: Window, env: Moli.Environment, logger: Moli.MoliLogger): DefineSlotsStep => (slots: Moli.AdSlot[]) => new Promise<SlotDefinition<any>[]>(resolve => {
  const slotDefinitions = slots.map(moliSlot => {
    const filterSupportedSizes = getSizeFilterFunction(window, moliSlot);
    const sizes = filterSupportedSizes(moliSlot.sizes);

    // lookup existing slots and use those if already present. This makes defineSlots idempotent
    const existingSlot = window.googletag.pubads().getSlots().find(s => s.getSlotElementId() === moliSlot.domId);
    const adSlot: googletag.IAdSlot | null = existingSlot ? existingSlot : (moliSlot.position === 'in-page' ?
        window.googletag.defineSlot(moliSlot.adUnitPath, sizes, moliSlot.domId) :
        window.googletag.defineOutOfPageSlot(moliSlot.adUnitPath, moliSlot.domId)
    );

    if (adSlot) {
      adSlot.setCollapseEmptyDiv(true);

      // required method call, but doesn't trigger ad loading as we use the disableInitialLoad
      window.googletag.display(adSlot.getSlotElementId());
      switch (env) {
        case 'production':
          adSlot.addService(window.googletag.pubads());
          logger.debug('DFP Service', `Register slot: [DomID] ${moliSlot.domId} [AdUnitPath] ${moliSlot.adUnitPath}`);
          // TODO priceRule is handled in another module and should be remove from the slotDefinitions
          return Promise.resolve<SlotDefinition<any>>({ moliSlot, adSlot, filterSupportedSizes, priceRule: undefined });
        case 'test':
          logger.warn('DFP Service', `Enabling content service on ${adSlot.getSlotElementId()}`);
          adSlot.addService(window.googletag.content());
          // TODO priceRule is handled in another module and should be remove from the slotDefinitions
          return Promise.resolve<SlotDefinition<any>>({ moliSlot, adSlot, filterSupportedSizes, priceRule: undefined });
        default:
          return Promise.reject(`invalid environment: ${env}`);
      }
    } else {
      const error = `Slot: [DomID] ${moliSlot.domId} [AdUnitPath] ${moliSlot.adUnitPath} is already defined. You may have called requestAds() multiple times`;
      logger.error('DFP Service', error);
      return Promise.reject(new Error(error));
    }

  });

  return Promise.all(slotDefinitions);
});

export const gptRequestAds = (window: Window, env: Moli.Environment, logger: Moli.MoliLogger, reportingService: ReportingService): RequestAdsStep => (slots: SlotDefinition<any>[]) => new Promise<void>(resolve => {
  switch (env) {
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

        window.googletag.content().setContent(adSlot, html);
      });
      break;
    case 'production':
      // clear targetings for each slot before refreshing
      window.googletag.pubads().refresh(slots.map(slot => slot.adSlot));
      break;
  }
  slots.forEach(slot => {
    logger.debug('DFP Service', `Refresh slot: [DomID] ${slot.moliSlot.domId} [AdUnitPath] ${slot.moliSlot.adUnitPath}`);
    reportingService.markRefreshed(slot.moliSlot);
  });


  resolve();
});
