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
import { MoliRuntime } from '../types/moliRuntime';
import { prebidjs } from '../types/prebidjs';
import { SizeConfigService } from './sizeConfigService';
import { resolveAdUnitPath } from './adUnitPath';
import { googletag } from '../types/googletag';
import { isNotNull, uniquePrimitiveFilter } from '../util/arrayUtils';
import { SupplyChainObject } from '../types/supplyChainObject';
import { resolveStoredRequestIdInOrtb2Object } from '../util/resolveStoredRequestIdInOrtb2Object';
import { createTestSlots } from '../util/test-slots';
import { AssetLoadMethod, IAssetLoaderService } from '../util/assetLoaderService';
import IPrebidJs = prebidjs.IPrebidJs;
import { AdServer, AdSlot, headerbidding, schain } from '../types/moliConfig';
import { packageJson } from 'ad-tag/gen/packageJson';
import { prebidOutstreamRenderer } from 'ad-tag/ads/prebid-outstream';

// if we forget to remove prebid from the configuration.
// the timeout is the longest timeout in buckets if available, or arbitrary otherwise
const prebidTimeout = (context: AdPipelineContext) => {
  return new Promise<void>((_, reject) => {
    context.window__.setTimeout(
      () =>
        reject(
          'Prebid did not resolve in time. Maybe you forgot to import the prebid distribution in the ad tag'
        ),
      5000
    );
  });
};

const prebidReady = (window: Window & prebidjs.IPrebidjsWindow) =>
  new Promise<void>(resolve => window.pbjs.que.push(resolve));

const isPrebidSlotDefinition = (
  slotDefinition: MoliRuntime.SlotDefinition
): slotDefinition is MoliRuntime.SlotDefinition<
  AdSlot & { prebid: headerbidding.PrebidAdSlotConfigProvider }
> => {
  return !!slotDefinition.moliSlot.prebid;
};

/**
 * Checks if an adUnit is already added via `pbjs.addAdUnits`
 *
 * NOTE: There's no record on why this check was added in the first place.
 *       In the future we may transition to a stateless approach where we do not add adUnits anymore
 *       and instead build them each time we request bids. The setting is called `ephemeralAdUnits`.
 * @param adUnit
 * @param window
 */
const isAdUnitDefined = (
  adUnit: prebidjs.IAdUnit,
  window: Window & prebidjs.IPrebidjsWindow
): boolean => {
  if (window.pbjs.adUnits) {
    return window.pbjs.adUnits.some(adUnit2 => adUnit.code === adUnit2.code);
  }
  return false;
};

/**
 * This method creates prebid ad unit definitions from the given slots.
 * There's a lot of filtering an mapping going on here.
 *
 * 1. slots without a `prebid` property are filtered out
 * 2. the `prebid` property is evaluated and the result is flattened. This allows to define multiple ad units for a
 *    single slot, which prebid calls "twin ad units"
 * 3. static floor prices are added if available
 * 4. add pubstack meta fields
 * 5. adUnitPath is resolved
 * 6. resolve stored request id and added to the ortb2Imp object
 * 7. filter out `mediaTypes` that are not defined or have no single size after size filtering
 * 8. filter out bids that are not supported by the label config
 *
 * @param context
 * @param prebidConfig
 * @param slots
 *
 * @return a list of prebid ad units. Those can either be added via `pbjs.addAdUnits` or used in `pbjs.requestBids`.
 */
const createdAdUnits = (
  context: AdPipelineContext,
  prebidConfig: headerbidding.PrebidConfig,
  slots: MoliRuntime.SlotDefinition[]
): prebidjs.IAdUnit[] => {
  const prebidAdUnits = slots
    .filter(isPrebidSlotDefinition)
    .map(({ moliSlot, priceRule, filterSupportedSizes }) => {
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
      context.logger__.debug(
        'Prebid',
        context.requestId__,
        'Price Rule',
        priceRule,
        moliSlot.domId,
        floors
      );

      return extractPrebidAdSlotConfigs(moliSlot.prebid)
        .map(prebidAdSlotConfig => {
          const mediaTypeBanner = prebidAdSlotConfig.adUnit.mediaTypes.banner;
          const mediaTypeVideo = prebidAdSlotConfig.adUnit.mediaTypes.video;
          const mediaTypeNative = prebidAdSlotConfig.adUnit.mediaTypes.native;

          const bannerSizes = mediaTypeBanner
            ? filterSupportedSizes(mediaTypeBanner.sizes).filter(SizeConfigService.isFixedSize)
            : [];
          const videoSizes = mediaTypeVideo
            ? filterVideoPlayerSizes(mediaTypeVideo.playerSize, filterSupportedSizes)
            : [];

          // filter bids ourselves and don't rely on prebid to have a stable API
          // we also remove the bid labels so prebid doesn't require them
          const bids: prebidjs.IBid[] = prebidAdSlotConfig.adUnit.bids
            .filter((bid: prebidjs.IBid) => context.labelConfigService__.filterSlot(bid))
            .filter(
              (bid: prebidjs.IBid) =>
                !bid.bidder ||
                (bid.bidder &&
                  !context.auction__.isBidderDisabled(moliSlot.domId, bid.bidder) &&
                  !context.auction__.isBidderFrequencyCappedOnSlot(moliSlot.domId, bid.bidder))
            )

            .map(bid => {
              // we remove the labelAll and labelAny fields from the bid object to ensure that prebid doesn't
              // interfere with the label filtering from our end
              const { labelAny: _, labelAll: __, ...bidCopy } = bid;
              return bidCopy;
            });
          const videoDimensionsWH =
            videoSizes.length > 0 && !mediaTypeVideo?.w && !mediaTypeVideo?.h
              ? {
                  w: videoSizes[0][0],
                  h: videoSizes[0][1]
                }
              : {};

          const backupVideoRenderer = prebidConfig.backupVideoRenderer;
          const video: prebidjs.IMediaTypes | undefined = mediaTypeVideo
            ? {
                video: {
                  ...mediaTypeVideo,
                  playerSize: videoSizes.length === 0 ? undefined : videoSizes,
                  ...videoDimensionsWH,
                  // inject a backup video renderer if configured
                  ...(backupVideoRenderer
                    ? { renderer: prebidOutstreamRenderer(moliSlot.domId, backupVideoRenderer.url) }
                    : {})
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
              context.adUnitPathVariables__
            )
          };

          const storedRequest = prebidAdSlotConfig.adUnit.ortb2Imp?.ext?.prebid?.storedrequest;

          const storedRequestWithSolvedId: { id: string } | null =
            storedRequest && storedRequest.id
              ? {
                  ...storedRequest,
                  id: resolveAdUnitPath(storedRequest.id, context.adUnitPathVariables__)
                }
              : null;

          return {
            ...prebidAdSlotConfig.adUnit,
            ...(storedRequest &&
              storedRequestWithSolvedId && {
                ortb2Imp: resolveStoredRequestIdInOrtb2Object(
                  prebidAdSlotConfig.adUnit.ortb2Imp,
                  storedRequestWithSolvedId
                )
              }),
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
        .filter(
          adUnit =>
            adUnit.bids.length > 0 &&
            adUnit.mediaTypes &&
            // some mediaType must be defined
            (adUnit.mediaTypes.banner || adUnit.mediaTypes.video || adUnit.mediaTypes.native) &&
            // if an adUnit is already defined we should not add it a second time
            !isAdUnitDefined(adUnit, context.window__)
        );
    });

  return prebidAdUnits.reduce((acc, adUnits) => [...acc, ...adUnits], []);
};

export const prebidInit = (assetService: IAssetLoaderService): InitStep =>
  mkInitStep('prebid-init', context => {
    context.window__.pbjs = context.window__.pbjs || ({ que: [] } as unknown as IPrebidJs);

    // enable configured analytic adapters in prebid. Note that longstanding analytics vendors usually have no
    // prebid analytics adapter, but rather are loaded through an external script. Like pubstack and assertive yield do this
    const analyticAdapters = context.config__.prebid?.analyticAdapters;
    if (analyticAdapters && analyticAdapters.length > 0) {
      context.window__.pbjs.que.push(() => {
        context.window__.pbjs.enableAnalytics(analyticAdapters);
      });
    }

    // if there's already prebid distribution loaded, just go ahead. Even if there's a distributionUrl set, we must not
    // load the external resources as this would create unintentional conflicts.
    if (context.window__.pbjs.libLoaded) {
      return Promise.resolve();
    } else if (context.config__.prebid?.distributionUrl) {
      // load as a side effect and don't block the pipeline
      assetService.loadScript({
        name: 'prebid',
        assetUrl: context.config__.prebid.distributionUrl,
        loadMethod: AssetLoadMethod.TAG
      });
      return Promise.resolve();
    } else {
      // if there's no distribution URL we assume that prebid is part of the ad tag itself.
      // the timeout makes sure that even if there are issues with the included prebid distribution, the pipeline does
      // not block forever.
      return Promise.race([prebidReady(context.window__), prebidTimeout(context)]);
    }
  });

export const prebidRemoveAdUnits = (prebidConfig: headerbidding.PrebidConfig): ConfigureStep =>
  mkConfigureStep(
    'prebid-remove-adunits',
    (context: AdPipelineContext) =>
      new Promise<void>(resolve => {
        // only try to remove ad units if the configuration is set to not use ephemeral ad units and prebid is defined
        // at all
        if (prebidConfig.ephemeralAdUnits !== true) {
          context.window__.pbjs = context.window__.pbjs || ({ que: [] } as unknown as IPrebidJs);
          const adUnits = context.window__.pbjs.adUnits;
          if (adUnits) {
            context.window__.pbjs.que.push(() => {
              context.logger__.debug('Prebid', `Destroying prebid adUnits`, adUnits);
              adUnits.forEach(adUnit => context.window__.pbjs.removeAdUnit(adUnit.code));
            });
          }
        }
        resolve();
      })
  );

export const prebidConfigure = (
  prebidConfig: headerbidding.PrebidConfig,
  schainConfig: schain.SupplyChainConfig
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

  return mkConfigureStep('prebid-configure', (context: AdPipelineContext, _slots: AdSlot[]) => {
    if (!result) {
      result = new Promise<void>(resolve => {
        if (prebidConfig.bidderSettings) {
          context.window__.pbjs.bidderSettings = prebidConfig.bidderSettings;
        }
        context.window__.pbjs.que.push(() => {
          const s2sConfig = prebidConfig.config.s2sConfig;
          if (s2sConfig) {
            const s2sConfigs: prebidjs.server.S2SConfig[] = Array.isArray(
              prebidConfig.config.s2sConfig
            )
              ? prebidConfig.config.s2sConfig
              : [prebidConfig.config.s2sConfig];

            // we are mutating the configuration in place, which is nasty, but is way easier than trying to copy this
            // into a new object and then back into the prebid configuration.
            s2sConfigs.forEach(s2sConfigEntry => {
              const h5v = s2sConfigEntry.extPrebid?.analytics?.h5v;
              if (h5v) {
                h5v.configLabel = context.window__.moli.configLabel;
                h5v.moliVersion = packageJson.version;
              }
            });
          }

          context.window__.pbjs.setConfig({
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
            context.window__.pbjs.setBidderConfig(
              { bidders: [bidder], config: { schain: mkSupplyChainConfig(nodes) } },
              true
            );
          });

          // configure ESP for googletag. This has to be called after setConfig and after the googletag has loaded.
          // don't add this to the init step.
          context.window__.pbjs.registerSignalSources &&
            context.window__.pbjs.registerSignalSources();
        });

        // the resolve is intentionally not inside the pbjs.que.push. At this point we do not need to block the pipeline
        resolve();
      });
    }
    return result;
  });
};

/**
 * Evaluates the prebid ad slot configuration provider and returns the result in an array.
 *
 * @param provider
 */
const extractPrebidAdSlotConfigs = (
  provider: headerbidding.PrebidAdSlotConfigProvider
): headerbidding.PrebidAdSlotConfig[] => {
  return Array.isArray(provider) ? provider : [provider];
};

export const prebidPrepareRequestAds = (
  prebidConfig: headerbidding.PrebidConfig
): PrepareRequestAdsStep =>
  mkPrepareRequestAdsStep(
    'prebid-prepare-adunits',
    LOW_PRIORITY,
    (context: AdPipelineContext, slots: MoliRuntime.SlotDefinition[]) =>
      new Promise<void>(resolve => {
        if (prebidConfig.ephemeralAdUnits) {
          resolve();
        } else {
          context.window__.pbjs.que.push(() => {
            const adUnits = createdAdUnits(context, prebidConfig, slots);
            adUnits.forEach(adUnit => {
              context.logger__.debug(
                'Prebid',
                context.requestId__,
                `Prebid add ad unit: [Code] ${adUnit.code}`,
                adUnit
              );
            });
            context.window__.pbjs.addAdUnits(adUnits);
          });
          resolve();
        }
      })
  );

export const prebidRequestBids = (
  prebidConfig: headerbidding.PrebidConfig,
  adServer: AdServer
): RequestBidsStep =>
  mkRequestBidsStep(
    'prebid-request-bids',
    (context: AdPipelineContext, slots: MoliRuntime.SlotDefinition[]) => {
      // The failsafe timeout is the maximum of the bidder timeout and the failsafe timeout.
      // This also ensure that the failsafe timeout is never smaller than the bidderTimeout, which would be a very
      // unexpected behavior.
      const failsafeTimeout = Math.max(
        (prebidConfig.config.bidderTimeout ?? 2000) + 3000,
        prebidConfig.failsafeTimeout ?? 0
      );
      const failsafe = new Promise<void>(resolve =>
        context.window__.setTimeout(resolve, failsafeTimeout)
      );
      const auction = new Promise<void>(resolve => {
        const slotsToRefresh = slots.filter(
          slot =>
            !context.auction__.isSlotThrottled(slot.moliSlot.domId, slot.adSlot.getAdUnitPath())
        );

        const requestObject: prebidjs.IRequestObj = prebidConfig.ephemeralAdUnits
          ? {
              adUnits: createdAdUnits(context, prebidConfig, slotsToRefresh)
            }
          : {
              adUnitCodes: slotsToRefresh
                .filter(isPrebidSlotDefinition)
                .map(slot => slot.moliSlot.domId)
            };

        // ad unit codes are required for setTargetingForGPTAsync
        const adUnitCodes =
          requestObject.adUnitCodes ||
          requestObject.adUnits
            ?.map(adUnit => adUnit.code)
            .filter(isNotNull)
            .filter(uniquePrimitiveFilter) ||
          [];

        // resolve immediately if no ad unit codes should be requested
        if (adUnitCodes.length === 0) {
          context.logger__.debug(
            'Prebid',
            'skip request bids. All slots were filtered.',
            slotsToRefresh.map(s => s.moliSlot)
          );
          return resolve();
        }

        // It seems that the bidBackHandler can be triggered more than once. The reason might be that
        // when a timeout for the prebid request occurs, the callback is executed. When the request finishes
        // afterward anyway the bidsBackHandler is called a second time.
        let adserverRequestSent = false;

        context.logger__.debug(
          'Prebid',
          `Prebid request bids: \n\t\t\t${adUnitCodes.join('\n\t\t\t')}`
        );

        const bidsBackHandler = (
          bidResponses: prebidjs.IBidResponsesMap | undefined,
          timedOut: boolean,
          auctionId: string
        ) => {
          context.logger__.info(
            'Prebid',
            auctionId,
            bidResponses,
            slots.map(s => s.moliSlot.domId)
          );
          // the bids back handler seems to run on a different thread
          // in consequence, we need to catch errors here to propagate them to top levels
          try {
            if (adserverRequestSent) {
              context.logger__.warn(
                'Prebid',
                `ad server request already sent [${context.requestId__}]. AuctionId ${auctionId}`
              );
              return;
            }

            if (!bidResponses) {
              context.logger__.warn(
                'Prebid',
                `Undefined bid response map for ad unit codes: ${adUnitCodes.join(', ')}`
              );
              return resolve();
            }

            adserverRequestSent = true;

            if (adServer === 'gam') {
              // execute synchronous handlers before proceeding
              context.runtimeConfig__.adPipelineConfig.prebidBidsBackHandler.forEach(handler =>
                handler(context, bidResponses, slots)
              );

              // set key-values for DFP to target the correct line items
              context.window__.pbjs.setTargetingForGPTAsync(adUnitCodes);
            }

            resolve();
          } catch (error) {
            context.logger__.error(
              'Prebid',
              'DfpService:: could not resolve bidsBackHandler' + JSON.stringify(error)
            );
            resolve();
          }
        };

        // finally call the auction
        context.window__.pbjs.que.push(() => {
          context.window__.pbjs.requestBids({
            ...requestObject,
            // we provide our own auctionId, so we can associate events with ad pipeline runs
            auctionId: context.auctionId__,
            // buckets (group of ad units) may have a separate timeout override
            timeout: context.bucket__?.timeout,
            bidsBackHandler: bidsBackHandler
          });
        });
      });
      return Promise.race([failsafe, auction]);
    }
  );

export const prebidDefineSlots =
  (): DefineSlotsStep => (context: AdPipelineContext, slots: AdSlot[]) => {
    const slotDefinitions = slots.map(moliSlot => {
      const sizeConfigService = new SizeConfigService(
        moliSlot.sizeConfig,
        context.labelConfigService__.getSupportedLabels(),
        context.window__
      );
      const filterSupportedSizes = sizeConfigService.filterSupportedSizes;

      // filter slots that shouldn't be displayed
      if (
        !(
          sizeConfigService.filterSlot(moliSlot) &&
          context.labelConfigService__.filterSlot(moliSlot)
        )
      ) {
        return Promise.resolve(null);
      }

      // fake it - otherwise the prebid-only support would be a huge refactoring
      const adSlot: googletag.IAdSlot = {
        getAdUnitPath: (): string => moliSlot.adUnitPath
      } as any;
      switch (context.env__) {
        case 'production':
          return Promise.resolve<MoliRuntime.SlotDefinition>({
            moliSlot,
            adSlot,
            filterSupportedSizes
          });
        case 'test':
          return Promise.resolve<MoliRuntime.SlotDefinition>({
            moliSlot,
            adSlot,
            filterSupportedSizes
          });
        default:
          return Promise.reject(`invalid environment: ${context.runtimeConfig__.environment}`);
      }
    });
    return Promise.all(slotDefinitions).then(slots => slots.filter(isNotNull));
  };

export const prebidRenderAds =
  (): RequestAdsStep => (context: AdPipelineContext, slots: MoliRuntime.SlotDefinition[]) => {
    return new Promise((resolve, reject) => {
      context.logger__.debug('Prebid', 'start rendering');
      try {
        switch (context.env__) {
          case 'test':
            context.logger__.debug('Prebid', 'Rendering test slots');
            createTestSlots(context, slots);
            break;
          case 'production':
            context.window__.pbjs
              .getHighestCpmBids()
              .filter(bid => bid && bid.adId)
              .forEach(winningBid => {
                const adSlotDiv = context.window__.document.getElementById(winningBid.adUnitCode);
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
                    context.window__.pbjs.renderAd(iframeDoc, winningBid.adId);

                    // most browsers have a default margin of 8px . We add those after prebid has written to the iframe.
                    // internally prebid uses document.write or inserts an element. Either way, this is safe to do here.
                    // document.write is sync.
                    // see https://github.com/prebid/Prebid.js/blob/92daa81f277598cbed486cf8be01ce796aa80c8f/src/prebid.js#L555-L588

                    const normalizeCss = `/*! normalize.css v8.0.1 | MIT License | github.com/necolas/normalize.css */button,hr,input{overflow:visible}progress,sub,sup{vertical-align:baseline}[type=checkbox],[type=radio],legend{box-sizing:border-box;padding:0}html{line-height:1.15;-webkit-text-size-adjust:100%}body{margin:0}details,main{display:block}h1{font-size:2em;margin:.67em 0}hr{box-sizing:content-box;height:0}code,kbd,pre,samp{font-family:monospace,monospace;font-size:1em}a{background-color:transparent}abbr[title]{border-bottom:none;text-decoration:underline;text-decoration:underline dotted}b,strong{font-weight:bolder}small{font-size:80%}sub,sup{font-size:75%;line-height:0;position:relative}sub{bottom:-.25em}sup{top:-.5em}img{border-style:none}button,input,optgroup,select,textarea{font-family:inherit;font-size:100%;line-height:1.15;margin:0}button,select{text-transform:none}[type=button],[type=reset],[type=submit],button{-webkit-appearance:button}[type=button]::-moz-focus-inner,[type=reset]::-moz-focus-inner,[type=submit]::-moz-focus-inner,button::-moz-focus-inner{border-style:none;padding:0}[type=button]:-moz-focusring,[type=reset]:-moz-focusring,[type=submit]:-moz-focusring,button:-moz-focusring{outline:ButtonText dotted 1px}fieldset{padding:.35em .75em .625em}legend{color:inherit;display:table;max-width:100%;white-space:normal}textarea{overflow:auto}[type=number]::-webkit-inner-spin-button,[type=number]::-webkit-outer-spin-button{height:auto}[type=search]{-webkit-appearance:textfield;outline-offset:-2px}[type=search]::-webkit-search-decoration{-webkit-appearance:none}::-webkit-file-upload-button{-webkit-appearance:button;font:inherit}summary{display:list-item}[hidden],template{display:none}`;
                    const iframeStyle = iframeDoc.createElement('style');
                    iframeStyle.appendChild(iframeDoc.createTextNode(normalizeCss));
                    iframeDoc.head.appendChild(iframeStyle);
                  } else {
                    context.logger__.error(
                      'Prebid',
                      `No access to iframe contentWindow for ad unit${winningBid.adUnitCode}`
                    );
                  }
                } else {
                  context.logger__.error(
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
  filterSupportedSizes: MoliRuntime.FilterSupportedSizes
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
