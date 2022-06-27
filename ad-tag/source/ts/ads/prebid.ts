import {
  AdPipelineContext,
  ConfigureStep,
  DefineSlotsStep,
  InitStep,
  LOW_PRIORITY,
  mkConfigureStep,
  mkInitStep,
  mkPrepareRequestAdsStep,
  mkRequestBidsStep,
  PrepareRequestAdsStep,
  RequestAdsStep,
  RequestBidsStep
} from './adPipeline';
import { Moli } from '../types/moli';
import { prebidjs } from '../types/prebidjs';
import { SizeConfigService } from './sizeConfigService';
import IPrebidJs = prebidjs.IPrebidJs;
import { resolveAdUnitPath } from './adUnitPath';
import { googletag } from '../types/googletag';
import { isNotNull } from '../util/arrayUtils';
import { SupplyChainObject } from '../types/supplyChainObject';

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

const prebidInitAndReady = (window: Window & prebidjs.IPrebidjsWindow) =>
  new Promise<void>(resolve => {
    window.pbjs = window.pbjs || ({ que: [] } as unknown as IPrebidJs);
    window.pbjs.que.push(resolve);
  });

const isPrebidSlotDefinition = (
  slotDefinition: Moli.SlotDefinition
): slotDefinition is Moli.SlotDefinition<
  Moli.AdSlot & { prebid: Moli.headerbidding.PrebidAdSlotConfigProvider }
> => {
  return !!slotDefinition.moliSlot.prebid;
};

const isAdUnitDefined = (
  adUnit: prebidjs.IAdUnit,
  window: Window & prebidjs.IPrebidjsWindow
): boolean => {
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
        context.window.pbjs = context.window.pbjs || ({ que: [] } as unknown as IPrebidJs);
        const adUnits = context.window.pbjs.adUnits;
        if (adUnits) {
          context.logger.debug('Prebid', `Destroying prebid adUnits`, adUnits);
          adUnits.forEach(adUnit => context.window.pbjs.removeAdUnit(adUnit.code));
        }
        resolve();
      })
  );

export const prebidConfigure = (
  prebidConfig: Moli.headerbidding.PrebidConfig,
  schainConfig: Moli.schain.SupplyChainConfig
): ConfigureStep => {
  let result: Promise<void>;

  const mkSupplyChainConfig = (
    nodes: SupplyChainObject.ISupplyChainNode[]
  ): prebidjs.schain.ISupplyChainConfig => ({
    validation: 'relaxed',
    config: {
      ver: '1.0',
      complete: 1,
      nodes
    }
  });

  return mkConfigureStep(
    'prebid-configure',
    (context: AdPipelineContext, _slots: Moli.AdSlot[]) => {
      if (!result) {
        result = new Promise<void>(resolve => {
          if (prebidConfig.bidderSettings) {
            context.window.pbjs.bidderSettings = prebidConfig.bidderSettings;
          }
          context.window.pbjs.setConfig({
            ...prebidConfig.config,
            // global schain configuration
            ...{ schain: mkSupplyChainConfig([schainConfig.supplyChainStartNode]) },
            // for module priceFloors
            ...{ floors: prebidConfig.config.floors || {} }
          });
          prebidConfig.schain.nodes.forEach(({ bidder, node, appendNode }) => {
            const nodes = [schainConfig.supplyChainStartNode];
            if (appendNode) {
              nodes.push(node);
            }
            context.window.pbjs.setBidderConfig(
              { bidders: [bidder], config: { schain: mkSupplyChainConfig(nodes) } },
              true
            );
          });

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

export const prebidPrepareRequestAds = (
  prebidConfig: Moli.headerbidding.PrebidConfig
): PrepareRequestAdsStep =>
  mkPrepareRequestAdsStep(
    'prebid-prepare-adunits',
    LOW_PRIORITY,
    (context: AdPipelineContext, slots: Moli.SlotDefinition[]) =>
      new Promise<void>(resolve => {
        const labels = context.labelConfigService.getSupportedLabels();
        const deviceLabel = context.labelConfigService.getDeviceLabel();

        const prebidAdUnits = slots
          .filter(isPrebidSlotDefinition)
          .map(({ moliSlot, priceRule, filterSupportedSizes }) => {
            const targeting = context.config.targeting;
            const keyValues = targeting && targeting.keyValues ? targeting.keyValues : {};
            const floorPrice = priceRule ? priceRule.floorprice : undefined;
            const floors: Pick<prebidjs.IAdUnit, 'floors'> | null = priceRule
              ? {
                  floors: {
                    currency: prebidConfig.config.currency.adServerCurrency,
                    schema: {
                      delimiter: '|',
                      fields: ['mediaType']
                    },
                    values: {
                      '*': priceRule.floorprice
                    }
                  }
                }
              : null;
            context.logger.debug(
              'Prebid',
              context.requestId,
              'Price Rule',
              priceRule,
              moliSlot.domId,
              floors
            );

            return extractPrebidAdSlotConfigs(
              {
                keyValues: keyValues,
                floorPrice: floorPrice,
                priceRule: priceRule,
                labels: labels,
                isMobile: deviceLabel === 'mobile'
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
                // we also remove the bid labels so prebid doesn't require them
                const bids: prebidjs.IBid[] = prebidAdSlotConfig.adUnit.bids
                  .filter((bid: prebidjs.IBid) => context.labelConfigService.filterSlot(bid))
                  .map(bid => {
                    return { bidder: bid.bidder, params: bid.params } as prebidjs.IBid;
                  });

                const videoDimensionsWH =
                  videoSizes.length > 0 && !mediaTypeVideo?.w && !mediaTypeVideo?.h
                    ? {
                        w: videoSizes[0][0],
                        h: videoSizes[0][1]
                      }
                    : {};
                const video: prebidjs.IMediaTypes | undefined = mediaTypeVideo
                  ? {
                      video: {
                        ...mediaTypeVideo,
                        playerSize: videoSizes.length === 0 ? undefined : videoSizes,
                        ...videoDimensionsWH
                      }
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

                const pubstack: prebidjs.IPubstackConfig = {
                  ...prebidAdSlotConfig.adUnit.pubstack,
                  adUnitPath: resolveAdUnitPath(
                    prebidAdSlotConfig.adUnit.pubstack?.adUnitPath || moliSlot.adUnitPath,
                    {
                      ...context.config.targeting?.adUnitPathVariables,
                      device: deviceLabel
                    }
                  )
                };

                return {
                  ...prebidAdSlotConfig.adUnit,
                  // use domId if adUnit code is not defined
                  code: prebidAdSlotConfig.adUnit.code || moliSlot.domId,
                  ...(prebidAdSlotConfig.adUnit.pubstack ? { pubstack } : {}),
                  mediaTypes: {
                    ...video,
                    ...banner,
                    ...native
                  },
                  bids: bids,
                  ...floors
                };
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
  adServer: Moli.AdServer,
  targeting: Moli.Targeting | undefined
): RequestBidsStep =>
  mkRequestBidsStep(
    'prebid-request-bids',
    (context: AdPipelineContext, slots: Moli.SlotDefinition[]) =>
      new Promise(resolve => {
        const adUnitCodes = slots.filter(isPrebidSlotDefinition).map(slot => slot.moliSlot.domId);

        // resolve immediately if no ad unit codes should be requested
        if (adUnitCodes.length === 0) {
          context.logger.debug(
            'Prebid',
            'skip request bids. All slots were filtered.',
            slots.map(s => s.moliSlot)
          );
          return resolve();
        }

        // It seems that the bidBackHandler can be triggered more than once. The reason might be that
        // when a timeout for the prebid request occurs, the callback is executed. When the request finishes
        // afterwards anyway the bidsBackHandler is called a second time.
        let adserverRequestSent = false;

        context.logger.debug(
          'Prebid',
          `Prebid request bids: \n\t\t\t${adUnitCodes.join('\n\t\t\t')}`
        );

        context.reportingService.markPrebidSlotsRequested(context.requestId);

        context.window.pbjs.requestBids({
          adUnitCodes: adUnitCodes,
          bidsBackHandler: (
            bidResponses: prebidjs.IBidResponsesMap | undefined,
            timedOut: boolean,
            auctionId: string
          ) => {
            context.logger.info(
              'Prebid',
              auctionId,
              bidResponses,
              slots.map(s => s.moliSlot.domId)
            );
            // the bids back handler seems to run on a different thread
            // in consequence, we need to catch errors here to propagate them to top levels
            try {
              if (adserverRequestSent) {
                context.logger.warn(
                  'Prebid',
                  `ad server request already sent [${context.requestId}]`,
                  auctionId,
                  slots.map(s => s.moliSlot)
                );
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

              if (adServer === 'gam') {
                // execute listener
                if (prebidConfig.listener) {
                  const keyValues = targeting && targeting.keyValues ? targeting.keyValues : {};
                  const prebidListener =
                    typeof prebidConfig.listener === 'function'
                      ? prebidConfig.listener({ keyValues: keyValues })
                      : prebidConfig.listener;
                  if (prebidListener.preSetTargetingForGPTAsync) {
                    try {
                      prebidListener.preSetTargetingForGPTAsync(bidResponses, timedOut, slots);
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
              }

              adUnitCodes.forEach(adUnitPath => {
                const bidResponse = bidResponses[adUnitPath];
                bidResponse
                  ? context.logger.debug(
                      'Prebid',
                      auctionId,
                      `Prebid bid response: [DomID]: ${adUnitPath} \n\t\t\t${bidResponse.bids.map(
                        bid =>
                          `[bidder] ${bid.bidder} [width] ${bid.width} [height] ${bid.height} [cpm] ${bid.cpm}`
                      )}`
                    )
                  : context.logger.debug(
                      'Prebid',
                      auctionId,
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

export const prebidDefineSlots =
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

      // fake it - otherwise the prebid-only support would be a huge refactoring
      const adSlot: googletag.IAdSlot = {
        getAdUnitPath: (): string => moliSlot.adUnitPath
      } as any;
      switch (context.env) {
        case 'production':
          return Promise.resolve<Moli.SlotDefinition>({ moliSlot, adSlot, filterSupportedSizes });
        case 'test':
          return Promise.resolve<Moli.SlotDefinition>({ moliSlot, adSlot, filterSupportedSizes });
        default:
          return Promise.reject(`invalid environment: ${context.config.environment}`);
      }
    });
    return Promise.all(slotDefinitions).then(slots => slots.filter(isNotNull));
  };

export const prebidRenderAds =
  (): RequestAdsStep => (context: AdPipelineContext, slots: Moli.SlotDefinition[]) => {
    return new Promise((resolve, reject) => {
      context.logger.debug('Prebid', 'start rendering');
      try {
        switch (context.env) {
          case 'test':
            context.logger.debug('Prebid', 'No test slot support yet');
            break;
          case 'production':
            context.window.pbjs
              .getHighestCpmBids()
              .filter(bid => bid && bid.adId)
              .forEach(winningBid => {
                const adSlotDiv = context.window.document.getElementById(winningBid.adUnitCode);
                if (adSlotDiv) {
                  const innerDiv = document.createElement('div');
                  innerDiv.style.setProperty('border', '0pt none');

                  // most of the settings are taken from the iframe created by gpt.js
                  const iframe = document.createElement('iframe');
                  iframe.scrolling = 'no';
                  iframe.frameBorder = '0';
                  iframe.marginHeight = '0';
                  iframe.marginHeight = '0';
                  iframe.name = `prebid_ads_iframe_${winningBid.adUnitCode}`;
                  iframe.title = '3rd party ad content';
                  iframe.sandbox.add(
                    'allow-forms',
                    'allow-popups',
                    'allow-popups-to-escape-sandbox',
                    'allow-same-origin',
                    'allow-scripts',
                    'allow-top-navigation-by-user-activation'
                  );
                  iframe.setAttribute('aria-label', 'Advertisment');
                  iframe.style.setProperty('border', '0');
                  iframe.style.setProperty('margin', '0');
                  iframe.style.setProperty('overflow', 'hidden');

                  innerDiv.appendChild(iframe);
                  adSlotDiv.appendChild(innerDiv);
                  const iframeDoc = iframe.contentWindow?.document;
                  if (iframeDoc) {
                    context.window.pbjs.renderAd(iframeDoc, winningBid.adId);
                  } else {
                    context.logger.error(
                      'Prebid',
                      `No access to iframe contentWindow for ad unit${winningBid.adUnitCode}`
                    );
                  }
                } else {
                  context.logger.error(
                    'Prebid',
                    `Could not locate ad slot with id ${winningBid.adUnitCode}`
                  );
                }
              });
            break;
        }
        resolve();
      } catch (e) {
        reject(e);
      }
    });
  };

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
    return (
      !!size && size.length === 2 && typeof size[0] === 'number' && typeof size[1] === 'number'
    );
  };

  if (!playerSize) {
    return [];
  }

  return filterSupportedSizes(isSinglePlayerSize(playerSize) ? [playerSize] : playerSize).filter(
    SizeConfigService.isFixedSize
  );
};
