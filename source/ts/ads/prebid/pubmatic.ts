import {prebidjs} from '../../../../types/prebidjs';
import {DfpSlotSize} from '../adNetworkSlot';

import IPubMaticBid = prebidjs.IPubMaticBid;
import PubMatic = prebidjs.PubMatic;

/*
 * PubMatic Configuration
 * ----------------------
 *
 * Request URL: hbopenbid.pubmatic.com
 */

const publisherId: string = '156843';

type AdTagDefiniton = {adtagId: number, width: number, height: number};

/**
 *
 * @param {DfpSlotSize[]} sizes the applicable ad slot sizes
 * @param {AdTagDefiniton[]} adtagDefinitions an adtag definition
 * @returns {prebidjs.IPubMaticBid[]} a list of bids that are legit to request
 */
const filterAndCreateBidFromAdtagDefinition = (sizes: DfpSlotSize[], adtagDefinitions: AdTagDefiniton[]): IPubMaticBid[] => {
  const fixedSizes = sizes.filter(size => size !== 'fluid') as [number, number][];
  return adtagDefinitions.filter(({width, height}) => {
    return fixedSizes.some(([slotWidth, slotHeight]) => height === slotHeight && width === slotWidth);
  }).map(adtag => createBidFromAdtagDefinition(adtag));
};

const createBidFromAdtagDefinition = ({adtagId, height, width}: AdTagDefiniton): IPubMaticBid => {
  return { bidder: PubMatic, params: { publisherId, adSlot: `${adtagId}@${width}x${height}`}} as IPubMaticBid;
};

export const pubMaticPrebidConfigHeaderArea = (dfpSlotSizes: DfpSlotSize[]): IPubMaticBid[] => {
  const slots: AdTagDefiniton[] = [
    {adtagId: 1423494, width: 728, height: 90},
    {adtagId: 1423495, width: 800, height: 250},
    {adtagId: 1423496, width: 970, height: 90},
    {adtagId: 1423497, width: 970, height: 250}
  ];
  return filterAndCreateBidFromAdtagDefinition(dfpSlotSizes, slots);
};

export const pubMaticPrebidConfigSkyscraperDesktop = (dfpSlotSizes: DfpSlotSize[]): IPubMaticBid[] => {
  const slots: AdTagDefiniton[] = [
    {adtagId: 1423498, width: 120, height: 600},
    {adtagId: 1423495, width: 160, height: 600},
    {adtagId: 1423496, width: 300, height: 600}
  ];
  return filterAndCreateBidFromAdtagDefinition(dfpSlotSizes, slots);
};

export const pubMaticPrebidConfigSidebar1Desktop = (dfpSlotSizes: DfpSlotSize[]): IPubMaticBid[] => {
  const slots: AdTagDefiniton[] = [
    {adtagId: 1423501, width: 300, height: 250},
    {adtagId: 1423502, width: 300, height: 600}
  ];
  return filterAndCreateBidFromAdtagDefinition(dfpSlotSizes, slots);
};

export const pubMaticPrebidConfigSidebar2Desktop: IPubMaticBid = createBidFromAdtagDefinition({adtagId: 1423503, width: 300, height: 250});

export const pubMaticPrebidConfigSidebar3Desktop = (dfpSlotSizes: DfpSlotSize[]): IPubMaticBid[] => {
  const slots: AdTagDefiniton[] = [
    {adtagId: 1423504, width: 300, height: 600},
    {adtagId: 1423505, width: 300, height: 250}
  ];
  return filterAndCreateBidFromAdtagDefinition(dfpSlotSizes, slots);
};

export const pubMaticPrebidConfigPos1Mobile: IPubMaticBid = createBidFromAdtagDefinition({adtagId: 1423510, width: 300, height: 250});
export const pubMaticPrebidConfigPos2Mobile: IPubMaticBid[] = [
  createBidFromAdtagDefinition({adtagId: 1622902, width: 300, height: 50}),
  createBidFromAdtagDefinition({adtagId: 1622904, width: 320, height: 50}),
  createBidFromAdtagDefinition({adtagId: 1622905, width: 300, height: 250})
];
export const pubMaticPrebidConfigPos3Mobile: IPubMaticBid = createBidFromAdtagDefinition({adtagId: 1423511, width: 300, height: 250});
export const pubMaticPrebidConfigStickyAd: IPubMaticBid[] = [
  createBidFromAdtagDefinition({adtagId: 1423512, width: 300, height: 50}), // FIXME the adtagId might change. This is a medium rectangle at the moment!
  createBidFromAdtagDefinition({adtagId: 1423513, width: 320, height: 20})
];

export const pubMaticPrebidConfigRelatedContentStream1Mobile: IPubMaticBid = createBidFromAdtagDefinition({adtagId: 1423514, width: 300, height: 250});
export const pubMaticPrebidConfigRelatedContentStream2Mobile: IPubMaticBid = createBidFromAdtagDefinition({adtagId: 1423515, width: 300, height: 250});
export const pubMaticPrebidConfigRelatedContentStream3Mobile: IPubMaticBid = createBidFromAdtagDefinition({adtagId: 1423516, width: 300, height: 250});
