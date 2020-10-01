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
import { prebidjs } from '../types/prebidjs';
import { SizeConfigService } from './sizeConfigService';

// if we forget to remove prebid from the configuration. The timeout is arbitrary
const prebidTimeout = (window: Window) =>
  new Promise<void>((_, reject) => {
    window.setTimeout(
      () =>
        reject(
          'Prebid did not resolve in time. Maybe you forgot to import the prebid distribution in the ad tag'
        ),
      5000
    );
  });

const prebidInitAndReady = (window: Window) =>
  new Promise<void>(resolve => {
    window.pbjs = window.pbjs || { que: [] };
    window.pbjs.que.push(resolve);
  });

const isPrebidSlotDefinition = (
  slotDefinition: Moli.SlotDefinition<Moli.AdSlot>
): slotDefinition is Moli.SlotDefinition<Moli.PrebidAdSlot> => {
  return !!slotDefinition.moliSlot.prebid;
};

const isAdUnitDefined = (adUnit: prebidjs.IAdUnit, window: Window): boolean => {
  if (window.pbjs.adUnits) {
    return window.pbjs.adUnits.some(adUnit2 => adUnit.code === adUnit2.code);
  }
  return false;
};

export const prebidInit = (): InitStep =>
  mkInitStep('prebid-init', context =>
    Promise.race([prebidInitAndReady(context.window), prebidTimeout(context.window)])
  );

export const prebidRemoveAdUnits = (): ConfigureStep =>
  mkConfigureStep(
    'prebid-remove-adunits',
    (context: AdPipelineContext) =>
      new Promise<void>(resolve => {
        context.window.pbjs = window.pbjs || { que: [] };
        const adUnits = context.window.pbjs.adUnits;
        if (adUnits) {
          context.logger.debug('Prebid', `Destroying prebid adUnits`, adUnits);
          adUnits.forEach(adUnit => context.window.pbjs.removeAdUnit(adUnit.code));
        }
        resolve();
      })
  );

export const prebidConfigure = (prebidConfig: Moli.headerbidding.PrebidConfig): ConfigureStep => {
  let result: Promise<void>;

  return mkConfigureStep(
    'prebid-configure',
    (context: AdPipelineContext, _slots: Moli.AdSlot[]) => {
      if (!result) {
        result = new Promise<void>(resolve => {
          if (prebidConfig.bidderSettings) {
            context.window.pbjs.bidderSettings = prebidConfig.bidderSettings;
          }
          context.window.pbjs.setConfig(prebidConfig.config);
          resolve();
        });
      }
      return result;
    }
  );
};

/**
 * Evaluates the prebid ad slot configuration provider and returns the result in an array.
 *
 * @param context
 * @param provider
 */
const extractPrebidAdSlotConfigs = (
  context: Moli.headerbidding.PrebidAdSlotContext,
  provider: Moli.headerbidding.PrebidAdSlotConfigProvider
): Moli.headerbidding.PrebidAdSlotConfig[] => {
  if (typeof provider === 'function') {
    const oneOrMoreConfigs = provider(context);
    return Array.isArray(oneOrMoreConfigs) ? oneOrMoreConfigs : [oneOrMoreConfigs];
  } else {
    return Array.isArray(provider) ? provider : [provider];
  }
};

export const prebidPrepareRequestAds = (): PrepareRequestAdsStep =>
  mkPrepareRequestAdsStep(
    'prebid-prepare-adunits',
    LOW_PRIORITY,
    (context: AdPipelineContext, slots: Moli.SlotDefinition[]) =>
      new Promise(resolve => {
        const prebidAdUnits = slots
          .filter(isPrebidSlotDefinition)
          .map(({ moliSlot, priceRule, filterSupportedSizes }) => {
            const targeting = context.config.targeting;
            const keyValues = targeting && targeting.keyValues ? targeting.keyValues : {};
            const floorPrice = priceRule ? priceRule.cpm : undefined;
            context.logger.debug(
              'Prebid',
              context.requestId,
              'Price Rule',
              priceRule,
              moliSlot.domId
            );

            return extractPrebidAdSlotConfigs(
              {
                keyValues: keyValues,
                floorPrice: floorPrice
              },
              moliSlot.prebid
            )
              .map(prebidAdSlotConfig => {
                const mediaTypeBanner = prebidAdSlotConfig.adUnit.mediaTypes.banner;
                const mediaTypeVideo = prebidAdSlotConfig.adUnit.mediaTypes.video;
                const mediaTypeNative = prebidAdSlotConfig.adUnit.mediaTypes.native;

                const bannerSizes = mediaTypeBanner
                  ? filterSupportedSizes(mediaTypeBanner.sizes).filter(
                      SizeConfigService.isFixedSize
                    )
                  : [];
                const videoSizes = mediaTypeVideo
                  ? filterVideoPlayerSizes(mediaTypeVideo.playerSize, filterSupportedSizes)
                  : [];

                // filter bids ourselves and don't rely on prebid to have a stable API
                const bids = prebidAdSlotConfig.adUnit.bids.filter((bid: prebidjs.IBid) =>
                  context.labelConfigService.filterSlot(bid)
                );

                const video =
                  mediaTypeVideo && videoSizes.length > 0
                    ? {
                        video: { ...mediaTypeVideo, playerSize: videoSizes }
                      }
                    : undefined;

                const banner =
                  mediaTypeBanner && bannerSizes.length > 0
                    ? {
                        banner: { ...mediaTypeBanner, sizes: bannerSizes }
                      }
                    : undefined;

                const native = mediaTypeNative
                  ? {
                      native: { ...mediaTypeNative }
                    }
                  : undefined;

                const pubstack = prebidAdSlotConfig.adUnit.pubstack
                  ? {
                      pubstack: prebidAdSlotConfig.adUnit.pubstack
                    }
                  : {};

                return {
                  code: moliSlot.domId,
                  mediaTypes: {
                    ...video,
                    ...banner,
                    ...native
                  },
                  bids: bids,
                  ...pubstack
                } as prebidjs.IAdUnit;
              })
              .filter(adUnit => {
                return (
                  adUnit.bids.length > 0 &&
                  adUnit.mediaTypes &&
                  // some mediaType must be defined
                  (adUnit.mediaTypes.banner ||
                    adUnit.mediaTypes.video ||
                    adUnit.mediaTypes.native) &&
                  // if an adUnit is already defined we should not add it a second time
                  !isAdUnitDefined(adUnit, context.window)
                );
              });
          });

        const prebidAdUnitsFlat = prebidAdUnits.reduce((acc, adUnits) => [...acc, ...adUnits], []);
        prebidAdUnitsFlat.forEach(adUnit => {
          context.logger.debug(
            'Prebid',
            context.requestId,
            `Prebid add ad unit: [Code] ${adUnit.code}`,
            adUnit
          );
        });
        context.window.pbjs.addAdUnits(prebidAdUnitsFlat);
        resolve();
      })
  );

export const prebidRequestBids = (
  prebidConfig: Moli.headerbidding.PrebidConfig,
  targeting: Moli.Targeting | undefined
): RequestBidsStep =>
  mkRequestBidsStep(
    'prebid-request-bids',
    (context: AdPipelineContext, slots: Moli.SlotDefinition[]) =>
      new Promise(resolve => {
        // It seems that the bidBackHandler can be triggered more than once. The reason might be that
        // when a timeout for the prebid request occurs, the callback is executed. When the request finishes
        // afterwards anyway the bidsBackHandler is called a second time.
        let adserverRequestSent = false;

        const adUnitCodes = slots.filter(isPrebidSlotDefinition).map(slot => slot.moliSlot.domId);

        context.logger.debug(
          'Prebid',
          `Prebid request bids: \n\t\t\t${adUnitCodes.join('\n\t\t\t')}`
        );

        context.reportingService.markPrebidSlotsRequested(context.requestId);

        context.window.pbjs.requestBids({
          adUnitCodes: adUnitCodes,
          labels: context.labelConfigService.getSupportedLabels(),
          bidsBackHandler: (bidResponses?: prebidjs.IBidResponsesMap, timedOut?: boolean) => {
            // the bids back handler seems to run on a different thread
            // in consequence, we need to catch errors here to propagate them to top levels
            try {
              if (adserverRequestSent) {
                return;
              }

              if (!bidResponses) {
                context.logger.warn(
                  'Prebid',
                  `Undefined bid response map for ad unit codes: ${adUnitCodes.join(', ')}`
                );
                return resolve();
              }

              adserverRequestSent = true;
              context.reportingService.measureAndReportPrebidBidsBack(context.requestId);

              // execute listener
              if (prebidConfig.listener) {
                const keyValues = targeting && targeting.keyValues ? targeting.keyValues : {};
                const prebidListener =
                  typeof prebidConfig.listener === 'function'
                    ? prebidConfig.listener({ keyValues: keyValues })
                    : prebidConfig.listener;
                if (prebidListener.preSetTargetingForGPTAsync) {
                  try {
                    prebidListener.preSetTargetingForGPTAsync(
                      bidResponses,
                      timedOut || false,
                      slots
                    );
                  } catch (e) {
                    context.logger.error(
                      'Prebid',
                      `Failed to execute prebid preSetTargetingForGPTAsync listener. ${e}`
                    );
                  }
                }
              }

              // set key-values for DFP to target the correct line items
              context.window.pbjs.setTargetingForGPTAsync(adUnitCodes);

              adUnitCodes.forEach(adUnitPath => {
                const bidResponse = bidResponses[adUnitPath];
                bidResponse
                  ? context.logger.debug(
                      'Prebid',
                      `Prebid bid response: [DomID]: ${adUnitPath} \n\t\t\t${bidResponse.bids.map(
                        bid =>
                          `[bidder] ${bid.bidder} [width] ${bid.width} [height] ${bid.height} [cpm] ${bid.cpm}`
                      )}`
                    )
                  : context.logger.debug(
                      'Prebid',
                      `Prebid bid response: [DomID] ${adUnitPath} ---> no bid response`
                    );
              });

              resolve();
            } catch (error) {
              context.logger.error(
                'Prebid',
                'DfpService:: could not resolve bidsBackHandler' + JSON.stringify(error)
              );
              resolve();
            }
          }
        });
      })
  );

/**
 * Filters video player sizes according to the sizeConfig;
 *
 *  * if no sizes are configured the `playerSize` is empty
 *  * if it is a single tuple ([number, number]), then this single tuple is checked and returned, if it fits.
 *  * if it's an array of sizes, the array is checked and the fitting entries are returned.
 *  * if all sizes are filtered out the `playerSize` is empty
 *
 * @param playerSize the (array of) player size(s)
 * @param filterSupportedSizes function provided by the global or slot-local sizeConfig to filter the slot's sizes
 */
const filterVideoPlayerSizes = (
  playerSize: prebidjs.IMediaTypeVideo['playerSize'],
  filterSupportedSizes: Moli.FilterSupportedSizes
): [number, number][] => {
  const isSinglePlayerSize = (
    size: prebidjs.IMediaTypeVideo['playerSize']
  ): size is [number, number] => {
    return size.length === 2 && typeof size[0] === 'number' && typeof size[1] === 'number';
  };

  return filterSupportedSizes(isSinglePlayerSize(playerSize) ? [playerSize] : playerSize).filter(
    SizeConfigService.isFixedSize
  );
};

/**
 * If a slot is being refreshed or reloaded.
 */
export const prebidRemoveHbKeyValues = (): PrepareRequestAdsStep =>
  mkPrepareRequestAdsStep(
    'prebid-remove-hb-keyvalues',
    LOW_PRIORITY,
    (context: AdPipelineContext, slots) =>
      new Promise(resolve => {
        // TODO check if prebid is taking care of this by itself in setGptTargetingAsync
        resolve();
      })
  );
