import {prebidjs} from '../../../../types/prebidjs';
import {DfpSlotSize} from '../adNetworkSlot';

import ICriteoBid = prebidjs.ICriteoBid;
import Criteo = prebidjs.Criteo;



/*
 * Criteo Configuration
 * --------------------
 *
 * Criteo header bidding request URL: `//bidder.criteo.com/cdb`
 *
 * Criteo only supports one adUnit-size combination per zoneId, which in turn means
 * that we need multiple ICriteoBid objects for a single adSlot to get bids for all
 * supported sizes.
 *
 * Even though the criteo prebid adapter sends the adUnit sizes along with the request,
 * the criteo backend doesn't evaluate them.
 *
 * We cannot use `sendAllBids` because of this restriction as prebid can only set one
 * key-value targeting per adUnit per SSP. Enabling sendAllBids will cause prebid to
 * use only the last bid in the bid response object as it overwrites the key-value
 * parameters (hb_pb_criteo, etc.) with the next bid response.
 *
 * These slots are not targeted but have been created.
 * There is also no matching slot for them. Ask Jenny & Criteo why these are here.
 * _ 853396  Gutefrage.net - DE - CHB - PB - 300x150
 * _ 772943  Gutefrage.net - DE - CHB - PB - 320x150
 * _ 772945  Gutefrage.net - DE - CHB - PB - 300x75
 *
 * We have no line items targeting these zoneIds
 * _ 772946  Gutefrage.net - DE - CHB - PB - Pos1 - 320x100
 * _ 853392  Gutefrage.net - DE - CHB - PB - Pos1 - 320x100
 */

const mediumRectangle300x250 = {size: [300, 250], zoneId: 1158151}; // Gutefrage.net - DE- CDB - PB - Desktop - 300x250

const leaderboard728x90  = {size: [728, 90], zoneId: 1158143}; // Gutefrage.net - DE- CDB - PB - Desktop - 728x90
const leaderboard800x250 = {size: [800, 250], zoneId: 1158144}; // Gutefrage.net - DE- CDB - PB - Desktop - 800x250
const leaderboard970x90  = {size: [970, 90], zoneId: 1165049}; // Gutefrage.net - DE- CDB - PB - Desktop - 970x90
const leaderboard970x250 = {size: [970, 250], zoneId: 1158146}; // Gutefrage.net - DE- CDB - PB - Desktop - 970x250

const sidebar300x600 = {size: [300, 600], zoneId: 1158150}; // Gutefrage.net - DE- CDB - PB - Desktop - 300x600
const sidebar200x600 = {size: [200, 600], zoneId: 1158149}; // Gutefrage.net - DE- CDB - PB - Desktop - 200x600
const sidebar160x600 = {size: [160, 600], zoneId: 1158148}; // Gutefrage.net - DE- CDB - PB - Desktop - 160x600
const sidebar120x600 = {size: [120, 600], zoneId: 1158147};

/**
 * Criteo doesn't handle the {{sizes}} parameter sent via prebid.js, but requires for each
 * format its own zoneId. As it's not clear what criteo does with the {{sizes}} parameter,
 * e.g. filtering invalid zoneIds as they don't match the size, we filter on our own to avoid
 * ads that are either too big or too small.
 *
 * @param {DfpSlotSize[]} sizes
 * @returns {prebidjs.ICriteoBid[]}
 */
// === Header Area ==
export const criteoPrebidConfigHeaderAreaDesktop = (sizes: DfpSlotSize[]): ICriteoBid[] => {
  const zoneIdBySize = [leaderboard728x90, leaderboard800x250, leaderboard970x90, leaderboard970x250];
  return filterZoneIdBySize(sizes, zoneIdBySize);
};

// === Sidebar1 ==
export const criteoPrebidConfigSidebar1Desktop =  (sizes: DfpSlotSize[]): ICriteoBid[] => {
  const zoneIdBySize = [sidebar300x600, sidebar200x600, sidebar160x600, sidebar120x600, mediumRectangle300x250];
  return filterZoneIdBySize(sizes, zoneIdBySize);
};

// === Sidebar2 ==
export const criteoPrebidConfigSidebar2Desktop =  (sizes: DfpSlotSize[]): ICriteoBid[] => {
  const zoneIdBySize = [mediumRectangle300x250];
  return filterZoneIdBySize(sizes, zoneIdBySize);
};

// === Sidebar3 ==
export const criteoPrebidConfigSidebar3Desktop =  (sizes: DfpSlotSize[]): ICriteoBid[] => {
  const zoneIdBySize = [sidebar300x600, sidebar200x600, sidebar160x600, sidebar120x600, mediumRectangle300x250];
  return filterZoneIdBySize(sizes, zoneIdBySize);
};

// === Skyscraper ===
export const criteoPrebidConfigSkyscraperDesktop = (sizes: DfpSlotSize[]): ICriteoBid[] => {
  const zoneIdBySize = [sidebar120x600, sidebar160x600, sidebar200x600, sidebar300x600];
  return filterZoneIdBySize(sizes, zoneIdBySize);
};

// === Pos1 Mobile ==
export const criteoPrebidConfigPos1Mobile: ICriteoBid[] = [
  {bidder: Criteo, params: {zoneId: 772942}}, // 300x250
  {bidder: Criteo, params: {zoneId: 772944}}, // 300x50
  {bidder: Criteo, params: {zoneId: 807381}}  // 320x50
];

// === Pos2 Mobile ==
export const criteoPrebidConfigPos2Mobile: ICriteoBid[] = [
  {bidder: Criteo, params: {zoneId: 1310472}}, // 300x250
  {bidder: Criteo, params: {zoneId: 1310468}}, // 300x50
  {bidder: Criteo, params: {zoneId: 1310469}}  // 320x50
];

// === Sticky Ad ==
export const criteoPrebidConfigStickyAd: ICriteoBid[] = [
  {bidder: Criteo, params: {zoneId: 853394}}, // 320x50
  {bidder: Criteo, params: {zoneId: 853395}}  // 300x50
];


// === Presenter Mobile ==
export const criteoPrebidConfigPresenterMobile = (sizes: DfpSlotSize[]): ICriteoBid[] => {

  const zoneIdBySize = [
    {size: [468, 60], zoneId: 1122995}, // Gutefrage.net - DE - CDB - PB - PresenterAd - 468x60
    {size: [728, 90], zoneId: 1122996}, // Gutefrage.net - DE - CDB - PB - PresenterAd - 728x90
    {size: [320, 50], zoneId: 1122997}, // Gutefrage.net - DE - CDB - PB - PresenterAd - 320x50
    {size: [300, 50], zoneId: 1122998}, // Gutefrage.net - DE - CDB - PB - PresenterAd - 300x50
    {size: [300, 75], zoneId: 1122999}, // Gutefrage.net - DE - CDB - PB - PresenterAd - 300x75
    {size: [300, 100], zoneId: 1123000}, // Gutefrage.net - DE - CDB - PB - PresenterAd - 300x100
    {size: [320, 75], zoneId: 1123001}, // Gutefrage.net - DE - CDB - PB - PresenterAd - 320x75
    {size: [320, 100], zoneId: 1123002} // Gutefrage.net - DE - CDB - PB - PresenterAd - 320x100
  ];

  return filterZoneIdBySize(sizes, zoneIdBySize);
};

/**
 * Function that filters all criteo sizes by the sizes that fit to the screen
 * and returns ICriteoBids that fit to the screen
 *
 * @param {DfpSlotSize[]} sizes, the sizes that fit the screen
 * @param {{size: number[]; zoneId: number}[]} zoneIdBySize, all of the sizes defined by criteo with the related zoneId
 * @returns {prebidjs.ICriteoBid[]} ICriteoBids that fit to the screen sizes
 */
export const filterZoneIdBySize = (sizes: DfpSlotSize[], zoneIdBySize: {size: number[], zoneId: number}[]):  ICriteoBid[] => {
  const fixedSizes = sizes.filter(size => size !== 'fluid') as [number, number][];
  return zoneIdBySize.filter(({size: [height, width]}) => {
    return fixedSizes.some(([slotHeight, slotWidth]) => height === slotHeight && width === slotWidth);
  }).map(({zoneId}) => {
    const bid: ICriteoBid = {bidder: Criteo, params: {zoneId}};
    return bid;
  });
};
