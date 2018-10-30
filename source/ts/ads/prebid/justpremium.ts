import { prebidjs } from '../../types/prebidjs';
import IJustPremiumBid = prebidjs.IJustPremiumBid;
import JustPremium = prebidjs.JustPremium;

/*
 * JustPremium Configuration
 * -------------------------
 *
 * JustPremium provide "premium" ads that can be requested via prebid.js
 * The formats break-out of their respective adSlot and change the site
 * accordingly.
 *
 * Requests are made to `pre.ads.justpremium.com`
 *
 */

export const justPremiumPrebidConfigHeaderArea: IJustPremiumBid = {bidder: JustPremium, params: {
  zone: '48663',
  allow: ['pd']
}};

export const justPremiumPrebidConfigSidebarDesktop: IJustPremiumBid = {bidder: JustPremium, params: {
  zone: '48663',
  allow: ['sa']
}};

export const justPremiumPrebidConfigFloorAdDesktop: IJustPremiumBid = {bidder: JustPremium, params: {
  zone: '48663',
  allow: ['pu', 'fa']
}};

export const justPremiumPrebidConfigWallpaper: IJustPremiumBid = {bidder: JustPremium, params: {
  zone: '51284',
  allow: ['wp']
}};

export const justPremiumPrebidConfigMobileScroller: IJustPremiumBid = {bidder: JustPremium, params: {
  zone: '51921',
  allow: ['is']
}};
