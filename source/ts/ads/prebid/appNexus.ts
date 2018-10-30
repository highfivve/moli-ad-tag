import {prebidjs} from '../../types/prebidjs';

import IAppNexusBid = prebidjs.IAppNexusASTBid;
import AppNexusAst = prebidjs.AppNexusAst;

/*
 * == AppNexus Configuration ==
 *
 * AppNexus supports multi sizes per placement.
 *
 * Request are made to `//ib.adnxs.com/ut/v3/prebid`
 *
 */

export const appNexusPrebidConfigPresenterMobile: IAppNexusBid = {bidder: AppNexusAst, params: {placementId: '12533265'}};
export const appNexusPrebidConfigPos1Mobile: IAppNexusBid = {bidder: AppNexusAst, params: {placementId: '11747147'}};
export const appNexusPrebidConfigStickyAd: IAppNexusBid = {bidder: AppNexusAst, params: {placementId: '11747267'}};

export const appNexusPrebidConfigHeaderAreaDesktop: IAppNexusBid = {bidder: AppNexusAst, params: {placementId: '12849624'}};
export const appNexusPrebidConfigSkyscraperDesktop: IAppNexusBid = {bidder: AppNexusAst, params: {placementId: '12849645'}};
export const appNexusPrebidConfigSidebar1Desktop: IAppNexusBid = {bidder: AppNexusAst, params: {placementId: '12849650'}};
export const appNexusPrebidConfigSidebar2Desktop: IAppNexusBid = {bidder: AppNexusAst, params: {placementId: '12849656'}};
export const appNexusPrebidConfigSidebar3Desktop: IAppNexusBid = {bidder: AppNexusAst, params: {placementId: '13337509'}};

export const appNexusPrebidConfigRelatedContentStream1Mobile: IAppNexusBid = {bidder: AppNexusAst, params: {placementId: '13337539'}};
export const appNexusPrebidConfigRelatedContentStream2Mobile: IAppNexusBid = {bidder: AppNexusAst, params: {placementId: '13337546'}};
export const appNexusPrebidConfigRelatedContentStream3Mobile: IAppNexusBid = {bidder: AppNexusAst, params: {placementId: '13337554'}};

/**
 * The configuration is heavily tied to the appnexus placement settings. Changes must be reflected on both sides.
 */
export const appNexusPrebidConfigPos2VideoDesktop: IAppNexusBid = {
  bidder: AppNexusAst,
  params: {
    placementId: '13906537',
    video: {
      /** This must match the configuration in the app nexus ui */
      frameworks: [1, 2]
    }
  }
};

/**
 * The configuration is heavily tied to the appnexus placement settings. Changes must be reflected on both sides.
 */
export const appNexusPrebidConfigPos2VideoMobile: IAppNexusBid = {
  bidder: AppNexusAst,
  params: {
    placementId: '13970743',
    video: {
      /** This must match the configuration in the app nexus ui */
      frameworks: [1, 2]
    }
  }
};
