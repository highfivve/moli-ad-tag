import { prebidjs } from '../../types/prebidjs';
import IOpenxBid = prebidjs.IOpenxBid;
import OpenX = prebidjs.OpenX;

/*
 * == OpenX Configuration ==
 *
 * OpenX supports multi sizes per placement.
 *
 * Request are made to `gutefrage-d.openx.net` - the delivery domain (delDomain)
 *
 */

const createBid = (unit: string): IOpenxBid => {
  return {
    bidder: OpenX,
    params: {
      // the delivery domain is the same for all our placements
      delDomain: 'gutefrage-d.openx.net',
      unit: unit
    }
  };
};

export const openxPrebidConfigPresenterMobile: IOpenxBid = createBid('540295752');
export const openxPrebidConfigPos1Mobile: IOpenxBid = createBid('540295753');
export const openxPrebidConfigPos2Mobile: IOpenxBid = createBid('540328921');
export const openxPrebidConfigStickyAd: IOpenxBid = createBid('540295757');


export const openxPrebidConfigHeaderAreaDesktop: IOpenxBid = createBid('540295747');
export const openxPrebidConfigSidebar1Desktop: IOpenxBid = createBid('540295748');
export const openxPrebidConfigSidebar2Desktop: IOpenxBid = createBid('540295749');
export const openxPrebidConfigSidebar3Desktop: IOpenxBid = createBid('540295750');
export const openxPrebidConfigSkyscraperDesktop: IOpenxBid = createBid('540295751');

export const openxPrebidConfigRelatedContentStream1Mobile: IOpenxBid = createBid('540295754');
export const openxPrebidConfigRelatedContentStream2Mobile: IOpenxBid = createBid('540295755');
export const openxPrebidConfigRelatedContentStream3Mobile: IOpenxBid = createBid('540295756');
