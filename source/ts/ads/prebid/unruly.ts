import { prebidjs } from '../../../../types/prebidjs';
import IUnrulyBid = prebidjs.IUnrulyBid;
import Unruly = prebidjs.Unruly;

/**
 * Requests are made to `https://targeting.unrulymedia.com/prebid`
 */

export const unrulyPrebidConfigPos2VideoMobile: IUnrulyBid = {
  bidder: Unruly,
  params: {
    siteId: 1100199,
    targetingUUID: '622a1d23-83b2-4f26-912e-dfe0ca29fd6f'
  }
};

export const unrulyPrebidConfigPos2VideoDesktop: IUnrulyBid = {
  bidder: Unruly,
  params: {
    siteId: 1100199,
    targetingUUID: '622a1d23-83b2-4f26-912e-dfe0ca29fd6f'
  }
};
