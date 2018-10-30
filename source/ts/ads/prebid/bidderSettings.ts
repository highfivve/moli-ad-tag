import { prebidjs } from '../../types/prebidjs';

/**
 * For any input cpm of type float, this method should return a string which matches the line item pattern of
 * <SSP>_Prebid_<return_value>, otherwise the bid result would be lost.
 *
 * Example
 * -------
 * bidder: Criteo
 * cpm: 1.71
 *
 * Criteo_Prebid_1.71
 *
 * Price Range
 * -----------
 * Currently the prices in dfp for all bidders are set from range 0.01 to 45.00.
 * _from 0.01 to 21.50 in 0.01 steps.
 * _from 21.50 to 45.00 in 0.50 steps.
 *
 *
 * The method is exported for easier testing only!
 *
 * @param bidResponse
 * @returns {string}
 */

export const cpmFromBidResponse = (bidResponse: prebidjs.IBidResponse): string => {
  const cpm = bidResponse.cpm;
  if (cpm <= 21.50) { // 1 cent granularity
    return (Math.floor(cpm * 100) / 100).toFixed(2);
  } else if (cpm <= 45.50) { // 50 cent granularity
    return (Math.floor(cpm * 2) / 2).toFixed(2);
  } else {
    return '45.50';
  }
};

/**
 * @see GD-992:
 * Clickperformance did 1 cent steps for all line items,
 * also for line items that's cpm is higher than 21.50.
 *
 * This means that we don't have to map certain lineitems to 50 cent steps,
 * only to 1 cent steps.
 *
 * The method is exported for easier testing only!
 *
 * @param bidResponse
 * @returns {string}
 */
export const cpmFromSmartAdServerBidResponse = (bidResponse: prebidjs.IBidResponse): string => {
  const cpm = bidResponse.cpm;
  if (cpm <= 45.50) { // 1 cent granularity
    return (Math.floor(cpm * 100) / 100).toFixed(2);
  } else {
    return '45.50';
  }
};

/**
 * Standard prebid bidder settings.
 *
 * We define these because the `sendAllBids` mechanism doesn't work with criteo's setup.
 * Criteo has a zoneId per AdUnit-Size combination. SendAllBids disables prebidjs highest
 * bid selection and prebid simply sends all bids per SSP as key-values. However prebid
 * assumes one bid per adUnit per SSP, which Criteo doesn't support.
 *
 * This requires us to set the adServer targeting manually for each SSP. The default values
 * are send along nevertheless, but the cpm calculation is missing, so we need to overwrite
 * it here as well.
 *
 * The method is exported for easier testing only!
 *
 * @type {prebidjs.IBidderSetting}
 * @see http://prebid.org/dev-docs/publisher-api-reference.html#module_pbjs.bidderSettings
 */
export const standardWithSuffix = (
  suffix: string,
  hbPbFromBidResponse: (bidResponse: prebidjs.IBidResponse) => string
): prebidjs.IBidderSetting => {
  return {
    adserverTargeting: [{
      key: `hb_bidder${suffix}`,
      val: (bidResponse: prebidjs.IBidResponse): string => bidResponse.bidder,
    }, {
      key: `hb_size${suffix}`,
      val: (bidResponse: prebidjs.IBidResponse): string => bidResponse.width + 'x' + bidResponse.height,
    }, {
      key: `hb_adid${suffix}`,
      val: (bidResponse: prebidjs.IBidResponse): string => bidResponse.adId,
    }, {
      key: `hb_pb${suffix}`,
      val: hbPbFromBidResponse
    }]
  };
};

/**
 * The bidder settings for all supported SSPs.
 *
 * @type {prebidjs.IBidderSettings}
 */
export const bidderSettings: prebidjs.IBidderSettings = {
  standard: standardWithSuffix(
    '',
    (bidResponse: prebidjs.IBidResponse): string => cpmFromBidResponse(bidResponse)
  ),
  criteo: standardWithSuffix(
    `_${prebidjs.Criteo}`,
    (bidResponse: prebidjs.IBidResponse): string => cpmFromBidResponse(bidResponse)
  ),
  appnexusAst: standardWithSuffix(
    `_${prebidjs.AppNexusAst}`,
    (bidResponse: prebidjs.IBidResponse): string => cpmFromBidResponse(bidResponse)
  ),
  improvedigital: standardWithSuffix(
    `_${prebidjs.ImproveDigital}`,
    (bidResponse: prebidjs.IBidResponse): string => cpmFromBidResponse(bidResponse)
  ),
  ix: standardWithSuffix(
    `_${prebidjs.IndexExchange}`,
    (bidResponse: prebidjs.IBidResponse): string => cpmFromBidResponse(bidResponse)
  ),
  nanoInteractive: standardWithSuffix(
    `_${prebidjs.NanoInteractive}`,
    (bidResponse: prebidjs.IBidResponse): string => cpmFromBidResponse(bidResponse)
  ),
  justpremium: standardWithSuffix(
    `_${prebidjs.JustPremium}`,
    (bidResponse: prebidjs.IBidResponse): string => cpmFromBidResponse(bidResponse)
  ),
  pubmatic: standardWithSuffix(
    `_${prebidjs.PubMatic}`,
    (bidResponse: prebidjs.IBidResponse): string => cpmFromBidResponse(bidResponse)
  ),
  openx: standardWithSuffix(
    `_${prebidjs.OpenX}`,
    (bidResponse: prebidjs.IBidResponse): string => cpmFromBidResponse(bidResponse)
  ),
  smartadserver: standardWithSuffix(
    `_${prebidjs.SmartAdServer}`,
    (bidResponse: prebidjs.IBidResponse): string => cpmFromSmartAdServerBidResponse(bidResponse)
  ),
  unruly: standardWithSuffix(
    `_${prebidjs.Unruly}`,
    (bidResponse: prebidjs.IBidResponse): string => cpmFromBidResponse(bidResponse)
  ),
  teads: standardWithSuffix(
    `_${prebidjs.Teads}`,
    (bidResponse: prebidjs.IBidResponse): string => cpmFromBidResponse(bidResponse)
  )
};
