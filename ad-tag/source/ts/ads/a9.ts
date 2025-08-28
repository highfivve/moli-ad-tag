import {
  AdPipelineContext,
  ConfigureStep,
  InitStep,
  LOW_PRIORITY,
  mkConfigureStep,
  mkConfigureStepOnce,
  mkInitStep,
  mkPrepareRequestAdsStep,
  mkRequestBidsStep,
  PrepareRequestAdsStep,
  RequestBidsStep
} from './adPipeline';
import { Moli } from '../types/moli';
import { AssetLoadMethod, IAssetLoaderService } from '../util/assetLoaderService';
import { isSizeEqual } from '../util/sizes';
import { SizeConfigService } from './sizeConfigService';
import { apstag } from '../types/apstag';
import { tcfapi } from '../types/tcfapi';
import TCPurpose = tcfapi.responses.TCPurpose;
import * as adUnitPath from './adUnitPath';
import { AdUnitPathVariables } from './adUnitPath';

const isA9SlotDefinition = (
  slotDefinition: Moli.SlotDefinition
): slotDefinition is Moli.SlotDefinition<
  Moli.AdSlot & { a9: Moli.headerbidding.A9AdSlotConfig }
> => {
  return !!slotDefinition.moliSlot.a9;
};

const hasRequiredConsent = (tcData: tcfapi.responses.TCData): boolean =>
  !tcData.gdprApplies ||
  (tcData.vendor.consents['793'] &&
    [
      TCPurpose.STORE_INFORMATION_ON_DEVICE,
      TCPurpose.SELECT_BASIC_ADS,
      TCPurpose.CREATE_PERSONALISED_ADS_PROFILE,
      TCPurpose.SELECT_PERSONALISED_ADS,
      TCPurpose.MEASURE_AD_PERFORMANCE,
      TCPurpose.APPLY_MARKET_RESEARCH,
      TCPurpose.DEVELOP_IMPROVE_PRODUCTS
    ].every(purpose => tcData.purpose.consents[purpose]));

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
          },
          dpa: function (): void {
            context.window.apstag._Q.push(['di', arguments]);
          },
          rpa: function (): void {
            context.window.apstag._Q.push(['ri', arguments]);
          },
          upa: function (): void {
            context.window.apstag._Q.push(['ui', arguments]);
          }
        };

        // only load a9 if consent is given for all purposes and Amazon Advertising (793)
        if (context.env !== 'test' && hasRequiredConsent(context.tcData)) {
          // async fetch as everything is already initialized
          assetService
            .loadScript({
              name: 'A9',
              loadMethod: AssetLoadMethod.TAG,
              assetUrl: config.scriptUrl
                ? config.scriptUrl
                : '//c.amazon-adsystem.com/aax2/apstag.js'
            })
            .catch(error => context.logger.error('failed to load apstag.js', error));
        }

        resolve();
      })
  );

export const a9Configure = (
  config: Moli.headerbidding.A9Config,
  schainConfig: Moli.schain.SupplyChainConfig
): ConfigureStep =>
  mkConfigureStep('a9-configure', (context: AdPipelineContext, _slots: Moli.AdSlot[]) => {
    const schainNodes = [schainConfig.supplyChainStartNode];
    if (config.schainNode) {
      schainNodes.push(config.schainNode);
    }
    return new Promise<void>(resolve => {
      context.window.apstag.init({
        pubID: config.pubID,
        adServer: 'googletag',
        // videoAdServer: '', TODO: Add video ad server
        bidTimeout: config.timeout,
        gdpr: {
          cmpTimeout: config.cmpTimeout
        },
        schain: {
          complete: 1,
          ver: '1.0',
          nodes: schainNodes
        }
      });
      resolve();
    });
  });

export const a9PublisherAudiences = (config: Moli.headerbidding.A9Config): ConfigureStep =>
  mkConfigureStepOnce(
    'a9-publisher-audiences',
    (context: AdPipelineContext, _slots: Moli.AdSlot[]) =>
      new Promise<void>(resolve => {
        const publisherAudience = config.publisherAudience;
        if (publisherAudience && publisherAudience.enabled) {
          const tokenConfig: apstag.ITokenConfig = {
            hashedRecords: [
              {
                type: 'email',
                record: publisherAudience.sha256Email
              }
            ]
          };

          context.logger.debug('A9', 'Enable publisher audiences');
          context.window.apstag.rpa(tokenConfig);

          // if the user consent changes update the token config
          if (context.window.__tcfapi) {
            let firstCall = true;
            context.window.__tcfapi('addEventListener', 2, tcdata => {
              // The event listener is called with the current state when added,
              // which would trigger an unnecessary update
              if (firstCall) {
                firstCall = false;
                return;
              }
              if (tcdata.eventStatus === tcfapi.status.EventStatus.USER_ACTION_COMPLETE) {
                context.logger.debug('A9', 'Update publisher audience token');
                context.window.apstag.upa(tokenConfig);
              }
            });
          }
        }
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

const resolveAdUnitPath = (
  path: string,
  slotDepth: Moli.headerbidding.A9SlotNamePathDepth | undefined,
  variables: AdUnitPathVariables
): string => {
  const adUnitPathWithoutChildId = adUnitPath.removeChildId(path);
  const truncated = slotDepth
    ? adUnitPath.withDepth(adUnitPathWithoutChildId, slotDepth)
    : adUnitPathWithoutChildId;
  return adUnitPath.resolveAdUnitPath(truncated, variables);
};

export const a9RequestBids = (config: Moli.headerbidding.A9Config): RequestBidsStep =>
  mkRequestBidsStep(
    'a9-fetch-bids',
    (context: AdPipelineContext, slotDefinitions: Moli.SlotDefinition[]) =>
      new Promise<void>(resolve => {
        if (!hasRequiredConsent(context.tcData)) {
          context.logger.debug('A9', 'Skip any due to missing consent');
          resolve();
          return;
        }

        const slots = slotDefinitions
          .filter(isA9SlotDefinition)
          .filter(slot => !context.auction.isSlotThrottled(slot.adSlot))
          .filter(slot => {
            const isVideo = slot.moliSlot.a9.mediaType === 'video';
            const filterSlot = context.labelConfigService.filterSlot(slot.moliSlot.a9);
            const sizesNotEmpty =
              slot.filterSupportedSizes(slot.moliSlot.sizes).filter(SizeConfigService.isFixedSize)
                .length > 0;
            return filterSlot && (isVideo || sizesNotEmpty);
          })
          .map(({ moliSlot, priceRule, filterSupportedSizes }) => {
            if (moliSlot.a9.mediaType === 'video') {
              return {
                slotID: moliSlot.domId,
                mediaType: 'video'
              } as apstag.IVideoSlot;
            } else {
              // Filter all sizes that we don't want to send requests to a9.
              const enabledSizes = config.supportedSizes
                ? moliSlot.sizes.filter(moliSize =>
                    config.supportedSizes?.some(supportedSize =>
                      isSizeEqual(supportedSize, moliSize)
                    )
                  )
                : moliSlot.sizes;

              // The configured max slot depth in either the slot config or the global a9 config.
              const adUnitPath = resolveAdUnitPath(
                moliSlot.adUnitPath,
                moliSlot.a9.slotNamePathDepth ?? config.slotNamePathDepth,
                context.adUnitPathVariables
              );

              return {
                slotID: moliSlot.domId,
                slotName: adUnitPath,
                sizes: filterSupportedSizes(enabledSizes).filter(SizeConfigService.isFixedSize),
                ...(config.enableFloorPrices && priceRule
                  ? // During the beta phase we need to be able to activate and deactivate floor prices
                    // We also need to do a currency conversion from EUR to USD (x1.19 , 08.03.2021)
                    // THe floor price is sent in EUR, amazon requires Cents
                    {
                      floor: {
                        value: Math.ceil(
                          context.window.pbjs?.convertCurrency
                            ? context.window.pbjs.convertCurrency(
                                priceRule.floorprice,
                                'EUR',
                                config.floorPriceCurrency || 'USD'
                              ) * 100
                            : priceRule.floorprice * 100 * 1.19
                        ),
                        currency: config.floorPriceCurrency || 'USD'
                      }
                    }
                  : {})
              } as apstag.IDisplaySlot;
            }
          });

        context.logger.debug(
          'A9',
          `Fetch '${slots.length}' A9 slots: ${slots.map(slot => `[slotID] ${slot.slotID}`)}`
        );

        if (slots.length === 0) {
          resolve();
        } else {
          context.reportingService.markA9fetchBids(context.requestId);
          context.window.apstag.fetchBids(
            { slots, ...(context.bucket?.timeout && { bidTimeout: context.bucket.timeout }) },
            (_bids: Object[]) => {
              context.reportingService.measureAndReportA9BidsBack(context.requestId);
              context.window.apstag.setDisplayBids();
              resolve();
            }
          );
        }
      })
  );
