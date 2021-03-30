import {
  AdPipelineContext,
  ConfigureStep,
  InitStep,
  LOW_PRIORITY,
  mkConfigureStep,
  mkInitStep,
  mkPrepareRequestAdsStep,
  mkRequestBidsStep,
  PrepareRequestAdsStep,
  RequestBidsStep
} from './adPipeline';
import { Moli } from '../types/moli';
import { AssetLoadMethod, IAssetLoaderService } from '../util/assetLoaderService';
import { SizeConfigService } from './sizeConfigService';
import { apstag } from '../types/apstag';

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

        // only load a9 if consent is given for all purposes and Amazon Advertising (793)
        const tcData = context.tcData;
        if (
          !tcData.gdprApplies ||
          (tcData.vendor.consents['793'] &&
            ['1', '2', '3', '4', '7', '9', '10'].every(purpose => tcData.purpose.consents[purpose]))
        ) {
          // async fetch as everything is already initialized
          assetService.loadScript({
            name: 'A9',
            loadMethod: AssetLoadMethod.TAG,
            assetUrl: config.scriptUrl ? config.scriptUrl : '//c.amazon-adsystem.com/aax2/apstag.js'
          });
        }

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

export const a9ClearTargetingStep = (): PrepareRequestAdsStep =>
  mkPrepareRequestAdsStep(
    'a9-clear-targeting',
    LOW_PRIORITY,
    (context: AdPipelineContext, slots: Array<Moli.SlotDefinition>) => {
      if (context.requestId === 0) {
        context.logger.debug('A9', 'skip ad slot clearing for first pipeline run');
        return Promise.resolve();
      }
      return new Promise<void>(resolve => {
        context.logger.debug('A9', 'clear a9 targetings');
        slots.forEach(({ adSlot }) => {
          adSlot
            .getTargetingKeys()
            .filter(key => key === 'amznp' || key === 'amznsz' || key === 'amznbid')
            .forEach(key => adSlot.clearTargeting(key));
        });
        resolve();
      });
    }
  );

export const a9RequestBids = (config: Moli.headerbidding.A9Config): RequestBidsStep =>
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
              slots: filteredSlots.map(({ moliSlot, priceRule, filterSupportedSizes }) => {
                if (moliSlot.a9.mediaType === 'video') {
                  return {
                    slotID: moliSlot.domId,
                    mediaType: 'video'
                  } as apstag.IVideoSlot;
                } else {
                  // Filter all sizes that we don't want to send requests to a9.
                  const enabledSizes = config.supportedSizes
                    ? moliSlot.sizes.filter(moliSize =>
                        config.supportedSizes?.some(
                          supportedSize =>
                            supportedSize[0] === moliSize[0] && supportedSize[1] === moliSize[1]
                        )
                      )
                    : moliSlot.sizes;

                  return {
                    slotID: moliSlot.domId,
                    slotName: moliSlot.adUnitPath,
                    sizes: filterSupportedSizes(enabledSizes).filter(SizeConfigService.isFixedSize),
                    ...(config.enableFloorPrices && priceRule
                      ? // During the beta phase we need to be able to activate and deactivate floor prices
                        // We also need to do a currency conversion from EUR to USD (x1.19 , 08.03.2021)
                        // THe floor price is sent in EUR, amazon requires Cents
                        {
                          floor: {
                            value: Math.ceil(priceRule.floorprice * 100 * 1.19),
                            currency: config.floorPriceCurrency || 'USD'
                          }
                        }
                      : {})
                  } as apstag.IDisplaySlot;
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
