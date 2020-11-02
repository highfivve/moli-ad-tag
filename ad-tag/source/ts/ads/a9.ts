import {
  AdPipelineContext,
  ConfigureStep,
  InitStep,
  mkConfigureStep,
  mkInitStep,
  mkRequestBidsStep,
  RequestBidsStep
} from './adPipeline';
import { Moli } from '../types/moli';
import { AssetLoadMethod, IAssetLoaderService } from '../util/assetLoaderService';
import { SizeConfigService } from './sizeConfigService';

const isA9SlotDefinition = (
  slotDefinition: Moli.SlotDefinition
): slotDefinition is Moli.SlotDefinition<Moli.A9AdSlot> => {
  return !!slotDefinition.moliSlot.a9;
};

/**
 * Initialize and load the A9 tag.
 *
 * IMPORTANT NOTE:
 * We can't load the A9 script in our <head> as this breaks the complete ad integration.
 * We weren't able to pin down the reason for this behaviour in a meaningful time, so we
 * stick to the current solution, which is also the suggested integration in the A9 docs.
 *
 *
 * @returns {Promise<void>}
 */
export const a9Init = (
  config: Moli.headerbidding.A9Config,
  assetService: IAssetLoaderService
): InitStep =>
  mkInitStep(
    'a9-init',
    (context: AdPipelineContext) =>
      new Promise<void>(resolve => {
        context.window.apstag = context.window.apstag || {
          _Q: [],
          init: function (): void {
            context.window.apstag._Q.push(['i', arguments]);
          },
          fetchBids: function (): void {
            context.window.apstag._Q.push(['f', arguments]);
          },
          setDisplayBids: function (): void {
            return;
          },
          targetingKeys: function (): void {
            return;
          }
        };

        // async fetch as everything is already initialized
        assetService.loadScript({
          name: 'A9',
          loadMethod: AssetLoadMethod.TAG,
          assetUrl: config.scriptUrl ? config.scriptUrl : '//c.amazon-adsystem.com/aax2/apstag.js'
        });

        resolve();
      })
  );

export const a9Configure = (config: Moli.headerbidding.A9Config): ConfigureStep =>
  mkConfigureStep(
    'a9-configure',
    (context: AdPipelineContext, _slots: Moli.AdSlot[]) =>
      new Promise<void>(resolve => {
        context.window.apstag.init({
          pubID: config.pubID,
          adServer: 'googletag',
          // videoAdServer: '', TODO: Add video ad server
          bidTimeout: config.timeout,
          gdpr: {
            cmpTimeout: config.cmpTimeout
          }
        });
        resolve();
      })
  );

export const a9ClearTargetingStep = (slotDomIds: Array<string>): ConfigureStep =>
  mkConfigureStep(
    'a9-clear-targeting',
    (context: AdPipelineContext) =>
      new Promise<void>(resolve => {
        context.window.googletag
          .pubads()
          .getSlots()
          .filter(slot => slotDomIds.indexOf(slot.getSlotElementId()) > -1)
          .forEach(slot => {
            slot.clearTargeting('amznp');
            slot.clearTargeting('amznsz');
            slot.clearTargeting('amznbid');
          });
        resolve();
      })
  );

export const a9RequestBids = (): RequestBidsStep =>
  mkRequestBidsStep(
    'a9-fetch-bids',
    (context: AdPipelineContext, slots: Moli.SlotDefinition[]) =>
      new Promise<void>(resolve => {
        const filteredSlots = slots.filter(isA9SlotDefinition).filter(slot => {
          const isVideo = slot.moliSlot.a9.mediaType === 'video';
          const filterSlot = context.labelConfigService.filterSlot(slot.moliSlot.a9);
          const sizesNotEmpty =
            slot.filterSupportedSizes(slot.moliSlot.sizes).filter(SizeConfigService.isFixedSize)
              .length > 0;
          return filterSlot && (isVideo || sizesNotEmpty);
        });

        context.logger.debug(
          'A9',
          `Fetch '${filteredSlots.length}' A9 slots: ${filteredSlots.map(
            slot => `[DomID] ${slot.moliSlot.domId} [AdUnitPath] ${slot.moliSlot.adUnitPath}`
          )}`
        );

        if (filteredSlots.length === 0) {
          resolve();
        } else {
          context.reportingService.markA9fetchBids(context.requestId);
          context.window.apstag.fetchBids(
            {
              slots: filteredSlots.map(({ moliSlot, filterSupportedSizes }) => {
                if (moliSlot.a9.mediaType === 'video') {
                  return {
                    slotID: moliSlot.domId,
                    mediaType: 'video'
                  };
                } else {
                  return {
                    slotID: moliSlot.domId,
                    slotName: moliSlot.adUnitPath,
                    sizes: filterSupportedSizes(moliSlot.sizes).filter(
                      SizeConfigService.isFixedSize
                    )
                  };
                }
              })
            },
            (_bids: Object[]) => {
              context.reportingService.measureAndReportA9BidsBack(context.requestId);
              context.window.apstag.setDisplayBids();
              resolve();
            }
          );
        }
      })
  );
