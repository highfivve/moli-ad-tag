import {prebidjs} from '../../../../types/prebidjs';

import IIndexExchangeBid = prebidjs.IIndexExchangeBid;
import IndexExchange = prebidjs.IndexExchange;

/*
 * == IndexExchange Configuration ==
 *
 * IndexExchange supports multi sizes per placement.
 *
 * Request are made to `casalemedia.com/cygnus`
 *
 */

export const indexExchangePrebidConfigPos1Mobile: IIndexExchangeBid[] = [
    {bidder: IndexExchange, params: {siteId: '216859', size: [300, 50]}},
    {bidder: IndexExchange, params: {siteId: '216859', size: [300, 250]}},
    {bidder: IndexExchange, params: {siteId: '216859', size: [320, 50]}}
  ];

export const indexExchangePrebidConfigPos2Mobile: IIndexExchangeBid[] = [
  {bidder: IndexExchange, params: {siteId: '304788', size: [300, 50]}},
  {bidder: IndexExchange, params: {siteId: '304788', size: [300, 250]}},
  {bidder: IndexExchange, params: {siteId: '304788', size: [320, 50]}}
];

export const indexExchangePrebidConfigStickyAd: IIndexExchangeBid[] = [
    {bidder: IndexExchange, params: {siteId: '217405', size: [300, 50]}},
    {bidder: IndexExchange, params: {siteId: '217405', size: [320, 50]}}
  ];

export const indexExchangePrebidConfigPresenterMobile: IIndexExchangeBid[] = [
    {bidder: IndexExchange, params: { siteId: '239676', size: [300, 50]}},
    {bidder: IndexExchange, params: { siteId: '239676', size: [300, 75]}},
    {bidder: IndexExchange, params: { siteId: '239676', size: [300, 100]}},
    {bidder: IndexExchange, params: { siteId: '239676', size: [320, 50]}},
    {bidder: IndexExchange, params: { siteId: '239676', size: [320, 75]}},
    {bidder: IndexExchange, params: { siteId: '239676', size: [320, 100]}},
    {bidder: IndexExchange, params: { siteId: '239676', size: [468, 60]}},
    {bidder: IndexExchange, params: { siteId: '239676', size: [728, 90]}}
  ];

export const indexExchangePrebidConfigHeaderAreaDesktop: IIndexExchangeBid[] = [
    {bidder: IndexExchange, params: {siteId: '254805', size: [728, 90]}},
    {bidder: IndexExchange, params: {siteId: '254805', size: [800, 225]}},
    {bidder: IndexExchange, params: {siteId: '254805', size: [800, 250]}},
    {bidder: IndexExchange, params: {siteId: '254805', size: [970, 80]}},
    {bidder: IndexExchange, params: {siteId: '254805', size: [970, 250]}}
  ];

export const indexExchangePrebidConfigSkyscraperDesktop: IIndexExchangeBid[] = [
    {bidder: IndexExchange, params: {siteId: '254806', size: [120, 600]}},
    {bidder: IndexExchange, params: {siteId: '254806', size: [160, 600]}},
    {bidder: IndexExchange, params: {siteId: '254806', size: [200, 600]}},
    {bidder: IndexExchange, params: {siteId: '254806', size: [300, 600]}}
  ];

export const indexExchangePrebidConfigSidebar1Desktop: IIndexExchangeBid[] = [
    {bidder: IndexExchange, params: {siteId: '254807', size: [120, 600]}},
    {bidder: IndexExchange, params: {siteId: '254807', size: [160, 600]}},
    {bidder: IndexExchange, params: {siteId: '254807', size: [200, 600]}},
    {bidder: IndexExchange, params: {siteId: '254807', size: [300, 600]}},
    {bidder: IndexExchange, params: {siteId: '254807', size: [300, 250]}}
  ];

export const indexExchangePrebidConfigSidebar2Desktop: IIndexExchangeBid[] = [
    {bidder: IndexExchange, params: {siteId: '271251', size: [300, 250]}}
  ];

export const indexExchangePrebidConfigSidebar3Desktop: IIndexExchangeBid[] = [
    {bidder: IndexExchange, params: {siteId: '271252', size: [120, 600]}},
    {bidder: IndexExchange, params: {siteId: '271252', size: [160, 600]}},
    {bidder: IndexExchange, params: {siteId: '271252', size: [200, 600]}},
    {bidder: IndexExchange, params: {siteId: '271252', size: [300, 600]}},
    {bidder: IndexExchange, params: {siteId: '271252', size: [300, 250]}}
  ];

export const indexExchangePrebidConfigRelatedContentStream1Mobile: IIndexExchangeBid[] = [
    {bidder: IndexExchange, params: {siteId: '271254', size: [300, 50]}},
    {bidder: IndexExchange, params: {siteId: '271254', size: [300, 250]}}
  ];

export const indexExchangePrebidConfigRelatedContentStream2Mobile: IIndexExchangeBid[] = [
    {bidder: IndexExchange, params: {siteId: '271255', size: [300, 50]}},
    {bidder: IndexExchange, params: {siteId: '271255', size: [300, 250]}}
  ];

export const indexExchangePrebidConfigRelatedContentStream3Mobile: IIndexExchangeBid[] = [
    {bidder: IndexExchange, params: {siteId: '271256', size: [300, 50]}},
    {bidder: IndexExchange, params: {siteId: '271256', size: [300, 250]}}
  ];
