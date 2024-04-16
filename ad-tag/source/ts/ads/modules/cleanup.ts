import {
  mkPrepareRequestAdsStep,
  PrepareRequestAdsStep,
  HIGH_PRIORITY,
  ConfigureStep,
  mkConfigureStepOncePerRequestAdsCycle,
  AdPipelineContext
} from '../adPipeline';
import { Moli } from '../../types/moli';

const cleanUp = (context: AdPipelineContext, configs: Moli.CleanupConfig[] | undefined) => {
  configs?.forEach(config => {
    if ('cssSelectors' in config.deleteMethod) {
      config.deleteMethod.cssSelectors.forEach((selector: string) => {
        const elements = context.window.document.querySelectorAll(selector);
        elements.forEach((element: Element) => {
          context.logger.debug(
            'Cleanup Module',
            `Remove elements with selector ${selector} from dom`
          );
          element.remove();
        });
      });
    }
    if ('jsAsString' in config.deleteMethod) {
      try {
        /*   context.logger.debug(
          'Cleanup Module',
          `Try to execute JS string: '${config.deleteMethod.jsAsString}'`
        );*/
        // eslint-disable-next-line no-eval
        eval(config.deleteMethod.jsAsString);
      } catch (e) {
        context.logger.error(
          'Cleanup Module',
          `Error executing JS string: '${config.deleteMethod.jsAsString}'`
        );
      }
    }
  });
};

export const destroyAllOutOfPageAdFormats = (
  cleanupConfig: Moli.modules.CleanupModuleConfig | undefined
): ConfigureStep =>
  mkConfigureStepOncePerRequestAdsCycle(
    'destroy-out-of-page-ad-format',
    (context: AdPipelineContext) => {
      if (cleanupConfig && cleanupConfig.enabled) {
        cleanUp(context, cleanupConfig?.configs);
      }
      return Promise.resolve();
    }
  );

// TODO update when global auction context is ready
const hasBidderWonLastAuction = (
  bidderThatWonLastAuctionOnSlot: string,
  bidderInConfig: string
): boolean => {
  // look at the single cleanup config and check if the configured bidder has won the last auction on the configured slot
  return bidderThatWonLastAuctionOnSlot === bidderInConfig;
};

export const destroySpecialFormatOfReloadedSlot = (
  config: Moli.modules.CleanupModuleConfig
): PrepareRequestAdsStep =>
  mkPrepareRequestAdsStep('cleanup-before-ad-reload', HIGH_PRIORITY, (context, slots) => {
    if (config.enabled) {
      const configsOfDomIdsThatNeedToBeCleaned = config.configs
        .filter(config => slots.map(slot => slot.moliSlot.domId).includes(config.domId))
        // TODO update when global auction context is ready / find bidder that won the last auction on the configured slot
        .filter(config => hasBidderWonLastAuction('Seedtag', config.bidder));

      cleanUp(context, configsOfDomIdsThatNeedToBeCleaned);
    }
    return Promise.resolve();
  });
