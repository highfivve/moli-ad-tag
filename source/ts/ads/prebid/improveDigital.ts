import { DfpSlotSize } from '../adNetworkSlot';
import { prebidjs } from '../../types/prebidjs';
import IImproveDigitalBid = prebidjs.IImproveDigitalBid;
import ImproveDigital = prebidjs.ImproveDigital;

/*
 * == ImproveDigital Configuration ==
 *
 * ImproveDigital supports multi sizes per placement.
 *
 * Request are made to `//ad.360yield.com/hb`
 *
 * == Multi Size Slots ==
 *
 * The improvedigital prebid adapter ignores the sizes provided by prebid and uses all the sizes that are defined
 * for the placement. For this reasons some placements need to be filtered according to the available sizes.
 *
 */

export const improveDigitalPrebidConfigPresenterMobile = (iABTier1: string, dfpSizes: DfpSlotSize[]): IImproveDigitalBid => {
  // select different placement id base on the available space
  let placementId: number;
  if (dfpSizes.some(slot => slot !== 'fluid' && slot[0] >= 728)) {
    placementId = 1119818;
  } else if (dfpSizes.some(slot => slot !== 'fluid' && slot[0] >= 468)) {
    placementId = 1171612;
  } else {
    placementId = 1171657;
  }

  return {
    bidder: ImproveDigital,
    placementCode: 'presenter',
    params: {placementId: placementId, keyValues: { category: [iABTier1]}}
  };
};
export const improveDigitalPrebidConfigPos1Mobile = (iABTier1: string): IImproveDigitalBid => {
  return {
    bidder: ImproveDigital,
    placementCode: 'pos1',
    params: {placementId: 1040097, keyValues: { category: [iABTier1]}}
  };
};
export const improveDigitalPrebidConfigPos2Mobile = (iABTier1: string): IImproveDigitalBid => {
  return {
    bidder: ImproveDigital,
    placementCode: 'pos2',
    params: {placementId: 1200248, keyValues: { category: [iABTier1]}}
  };
};

export const improveDigitalPrebidConfigStickyAd = (iABTier1: string): IImproveDigitalBid => {
  return {
    bidder: ImproveDigital,
    placementCode: 'sticky',
    params: {placementId: 1060328, keyValues: { category: [iABTier1]}}};
};

export const improveDigitalPrebidConfigHeaderAreaDesktop = (iABTier1: string): IImproveDigitalBid => {
  return {
    bidder: ImproveDigital,
    placementCode: 'desktop top',
    params: {placementId: 1136383, keyValues: {category: [iABTier1]}}
  };
};

export const improveDigitalPrebidConfigSidebar1Desktop = (iABTier1: string): IImproveDigitalBid => {
  return {
    bidder: ImproveDigital,
    placementCode: 'sidebar',
    params: {placementId: 1136385, keyValues: {category: [iABTier1]}}
  };
};

export const improveDigitalPrebidConfigSidebar2Desktop = (iABTier1: string): IImproveDigitalBid => {
  return {
    bidder: ImproveDigital,
    placementCode: 'sidebar-2',
    params: {placementId: 1160064, keyValues: {category: [iABTier1]}}
  };
};

export const improveDigitalPrebidConfigSidebar3Desktop = (iABTier1: string): IImproveDigitalBid => {
  return {
    bidder: ImproveDigital,
    placementCode: 'sidebar-3',
    params: {placementId: 1160065, keyValues: {category: [iABTier1]}}
  };
};

export const improveDigitalPrebidConfigSkyscraperDesktop = (iABTier1: string): IImproveDigitalBid => {
  return{
    bidder: ImproveDigital,
    placementCode: 'sidebar',
    params: {placementId: 1136388, keyValues: {category: [iABTier1]}}
  };
};

export const improveDigitalPrebidConfigRelatedContentStream1Mobile = (iABTier1: string): IImproveDigitalBid => {
  return {
    bidder: ImproveDigital,
    placementCode: 'related-content-stream-1',
    params: {placementId: 1160066, keyValues: { category: [iABTier1]}}
  };
};

export const improveDigitalPrebidConfigRelatedContentStream2Mobile = (iABTier1: string): IImproveDigitalBid => {
  return {
    bidder: ImproveDigital,
    placementCode: 'related-content-stream-2',
    params: {placementId: 1160067, keyValues: { category: [iABTier1]}}
  };
};

export const improveDigitalPrebidConfigRelatedContentStream3Mobile = (iABTier1: string): IImproveDigitalBid => {
  return {
    bidder: ImproveDigital,
    placementCode: 'related-content-stream-3',
    params: {placementId: 1160068, keyValues: { category: [iABTier1]}}
  };
};
