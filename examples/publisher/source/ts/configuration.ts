import { Moli, prebidjs } from '@highfivve/ad-tag';
import { bidderSettings } from './bidderSettings';

const logger: Moli.MoliLogger = {
  debug(message?: any, ...optionalParams: any[]): void {
    window.console.debug(`[debug] ${message}`, ...optionalParams);
  },
  info(message?: any, ...optionalParams: any[]): void {
    window.console.info(`[info] ${message}`, ...optionalParams);
  },
  warn(message?: any, ...optionalParams: any[]): void {
    window.console.warn(`[warn] ${message}`, ...optionalParams);
  },
  error(message?: any, ...optionalParams: any[]): void {
    window.console.error(`[error] ${message}`, ...optionalParams);
  }

};

const teadsVerticalBid = (placementId: number, pageId: number, labelAll: string[]): prebidjs.ITeadsBid => {
  return {
    bidder: prebidjs.Teads,
    params: {
      placementId: placementId,
      pageId: pageId
    },
    labelAll: [ prebidjs.Teads, ...labelAll ]
  };
};

const unrulyBid = (siteId: number, targetingUUID: string): prebidjs.IUnrulyBid => {
  return {
    bidder: prebidjs.Unruly,
    params: {
      siteId,
      targetingUUID
    },
    labelAll: [ prebidjs.Unruly ]
  };
};

const spotxBid = (channelId: string, slot: string): prebidjs.ISpotXBid => {
  return {
    bidder: prebidjs.Spotx,
    params: {
      channel_id: channelId,
      ad_unit: 'outstream',
      outstream_options: {
        slot: slot,
        playersize_auto_adapt: true
      }
    },
    labelAll: [ prebidjs.Spotx ]
  };
};

const appNexusOutstream = (placementId: string): prebidjs.IAppNexusASTBid => {
  return {
    bidder: prebidjs.AppNexusAst,
    params: {
      placementId: placementId,
      video: { playback_method: [ 'auto_play_sound_off' ] }
    },
    labelAll: [ prebidjs.AppNexusAst ]
  };
};

const showHeroes = (playerId: string): prebidjs.IShowHeroesBid => {
  return {
    bidder: prebidjs.ShowHeroes,
    params: {
      playerId: playerId,
      vpaidMode: true
    }
  };
};

export const adConfiguration: Moli.MoliConfig = {
  slots: [
    {
      position: 'in-page',
      domId: 'eager-loading-adslot',
      behaviour: { loaded: 'eager' },
      adUnitPath: '/33559401/gf/fragen/RelatedContentStream',
      sizes: [ 'fluid', [ 605, 165 ], [ 605, 340 ], [ 1, 1 ] ],
      sizeConfig: [
        {
          mediaQuery: '(min-width: 768px)',
          sizesSupported: [ 'fluid', [ 605, 165 ], [ 605, 340 ], [ 1, 1 ] ]
        }
      ]
    },
    {
      position: 'in-page',
      domId: 'eager-loading-adslot-not-in-dom',
      behaviour: { loaded: 'eager' },
      adUnitPath: '/33559401/gf/fragen/RelatedContentStream',
      sizes: [ 'fluid', [ 605, 165 ], [ 300, 250 ] ],
      sizeConfig: [
        {
          mediaQuery: '(min-width: 768px)',
          sizesSupported: [ 'fluid', [ 605, 165 ] ]
        },
        {
          mediaQuery: '(max-width: 767px)',
          sizesSupported: [ 'fluid', [ 300, 250 ] ]
        }
      ]
    },
    {
      position: 'in-page',
      domId: 'prebid-adslot',
      behaviour: { loaded: 'eager' },
      // adUnitPath: '/33559401/gf/fragen/pos2',
      adUnitPath: '/55155651/outstream_test',
      sizes: [ [ 605, 165 ], [ 605, 340 ], [ 1, 1 ] ],
      prebid: {
        adUnit: {
          code: 'prebid-adslot',
          mediaTypes: {
            banner: {
              sizes: [ [ 300, 50 ], [ 300, 250 ], [ 320, 50 ] ]
            },
            video: {
              context: 'outstream',
              playerSize: ([ [ 605, 340 ], [ 536, 302 ], [ 300, 169 ] ] as [ number, number ][])
            }
          },
          bids: [
            // Unruly test placement
            unrulyBid(1081534, '6f15e139-5f18-49a1-b52f-87e5e69ee65e'),
            // SpotX test placement
            spotxBid('85394', 'prebid-adslot'),
            // Teads fallback placements
            teadsVerticalBid(94142, 101939, [ 'desktop' ]),
            teadsVerticalBid(94140, 101937, [ 'mobile' ]),
            // AppNexus Test Placement - outstream only
            // see http://prebid.org/examples/video/outstream/outstream-dfp.html
            appNexusOutstream('13232385'),
            // ShowHeroes test placement
            showHeroes('3f81f1c8-5d96-4d8b-a875-859759e9049b')
          ]
        }
      },
      sizeConfig: [
        {
          mediaQuery: '(min-width: 768px)',
          sizesSupported: [ [ 605, 165 ], [ 605, 340 ], [ 1, 1 ] ]
        }
      ]
    },
    {
      position: 'in-page',
      domId: 'a9-adslot',
      behaviour: { loaded: 'eager' },
      adUnitPath: '/33559401/gf/fragen/RelatedContentStream3',
      sizes: [ 'fluid', [ 605, 165 ], [ 300, 250 ] ],
      a9: {
        labelAll: [ 'a9', 'desktop' ]
      },
      sizeConfig: [
        {
          mediaQuery: '(min-width: 768px)',
          sizesSupported: [ 'fluid', [ 605, 165 ] ]
        },
        {
          mediaQuery: '(max-width: 767px)',
          sizesSupported: [ 'fluid', [ 300, 250 ] ]
        }
      ]
    },
    // -------------------------
    // AppNexus Test Placements
    // -------------------------

    // multi format
    // see http://prebid.org/examples/multi_format_example.html
    {
      position: 'in-page',
      domId: 'appNexus-multiformat-adSlot',
      behaviour: { loaded: 'eager' },
      adUnitPath: '/19968336/prebid_multiformat_test',
      sizes: [ [ 640, 480 ], [ 300, 250 ], [ 360, 360 ], [ 1, 1 ] ],
      prebid: {
        adUnit: {
          code: 'appNexus-multiformat-adSlot',
          mediaTypes: {
            banner: {
              sizes: [ [ 300, 250 ] ]
            },
            // enable once we support native
            // native: {
            //   type: 'image'
            // }
            video: {
              context: 'outstream',
              playerSize: [ 300, 250 ]
            }
          },
          bids: [
            appNexusOutstream('13232392')
          ],
        }
      },
      sizeConfig: [
        {
          mediaQuery: '(min-width: 768px)',
          sizesSupported: [ [ 640, 480 ], [ 300, 250 ], [ 360, 360 ], [ 1, 1 ] ]
        }
      ]
    }

  ],
  targeting: {
    keyValues: {
      'static': 'from-config'
    },
    labels: [
      // activate teads, spotx, appNexus and/or unruly via the label query param
      prebidjs.Criteo, prebidjs.ImproveDigital,
      prebidjs.IndexExchange, prebidjs.PubMatic, prebidjs.Yieldlab
    ]
  },
  labelSizeConfig: [
    {
      labelsSupported: [ 'mobile' ],
      mediaQuery: '(max-width: 767px)'
    },
    {
      labelsSupported: [ 'desktop', 'tablet' ],
      mediaQuery: '(min-width: 768px)'
    }
  ],
  prebid: {
    bidderSettings: bidderSettings,
    config: {
      bidderTimeout: 1000,
      consentManagement: {
        timeout: 500,
        allowAuctionWithoutConsent: true
      },
      userSync: {
        syncDelay: 6000,
        filterSettings: {
          iframe: {
            bidders: [ prebidjs.PubMatic, prebidjs.SmartAdServer ],
            filter: 'include'
          },
          // by default, prebid enables the image sync for all SSPs. We make it explicit here.
          image: {
            bidders: '*',
            filter: 'include'
          }
        }
      },
      currency: {
        adServerCurrency: 'EUR',
        granularityMultiplier: 1,
        // taken from: https://currency.prebid.org/latest.json
        defaultRates: {
          'USD': {
            'EUR': 0.8695652174
          }
        }
      },
      improvedigital: {
        singleRequest: true,
        usePrebidSizes: true,
      }
    }
  },
  a9: {
    timeout: 1000,
    cmpTimeout: 500,
    pubID: 'test'
  },
  consent: { },
  logger: logger
};
