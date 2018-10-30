import { prebidjs } from '../../types/prebidjs';
import ISmartAdServerBid = prebidjs.ISmartAdServerBid;
import SmartAdServer = prebidjs.SmartAdServer;
/*
 * == Smart AdServer Configuration ==
 *
 * Request are made to `prg.smartadserver.com`
 *
 * The siteTags can be generated on this admin page:
 * https://manage.smartadserver.com/Admin/Administration/SiteTag/
 *
 */

/**
 * Creates a smart bid with all static values set.
 *
 * @param pageId - we differentiate between mobile (993628) and desktop (993627)
 * @param formatId - identifies the actual placement
 */
const createBid = (pageId: 993627 | 993628, formatId: number): ISmartAdServerBid => {
  return {
    bidder: SmartAdServer,
    params: {
      // the siteID is fixed
      siteId: 262786,
      pageId,
      formatId,
      currency: 'EUR',
      domain: '//prg.smartadserver.com'
    }
  };
};

export const smartPrebidConfigPresenterMobile: ISmartAdServerBid = createBid(993628, 69664);
export const smartPrebidConfigPos1Mobile: ISmartAdServerBid = createBid(993628, 69665);
export const smartPrebidConfigPos2Mobile: ISmartAdServerBid = createBid(993628, 69670);
export const smartPrebidConfigStickyAd: ISmartAdServerBid = createBid(993628, 69669);


export const smartPrebidConfigHeaderAreaDesktop: ISmartAdServerBid = createBid(993627, 69658);
export const smartPrebidConfigSidebar1Desktop: ISmartAdServerBid = createBid(993627, 69659);
export const smartPrebidConfigSidebar2Desktop: ISmartAdServerBid = createBid(993627, 69660);
export const smartPrebidConfigSidebar3Desktop: ISmartAdServerBid = createBid(993627, 69661);
export const smartPrebidConfigSkyscraperDesktop: ISmartAdServerBid = createBid(993627, 69662);

export const smartPrebidConfigPos2VideoDesktop: ISmartAdServerBid = createBid(993627, 69663);

export const smartPrebidConfigRelatedContentStream1Mobile: ISmartAdServerBid = createBid(993628, 69666);
export const smartPrebidConfigRelatedContentStream2Mobile: ISmartAdServerBid = createBid(993628, 69667);
export const smartPrebidConfigRelatedContentStream3Mobile: ISmartAdServerBid = createBid(993628, 69668);
