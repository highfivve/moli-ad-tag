import { prebidjs } from '../../../../types/prebidjs';
import Teads = prebidjs.Teads;
import ITeadsBid = prebidjs.ITeadsBid;

/**
 * Requests are made to `http://a.teads.tv/hb/bid-request`
 */

export const teadsPrebidConfigPos2VideoMobile: ITeadsBid = {
  bidder: Teads,
  params: {
    // TODO
    placementId: 0,
    pageId: 1
  }
};

export const teadsPrebidConfigPos2VideoDesktop: ITeadsBid = {
  bidder: Teads,
  params: {
    // TODO
    placementId: 2,
    pageId: 3
  }
};
