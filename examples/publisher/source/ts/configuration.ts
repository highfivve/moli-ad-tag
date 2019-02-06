import { Moli } from 'moli-ad-tag/source/ts/types/moli';
import { prebidjs } from 'moli-ad-tag/source/ts/types/prebidjs';
import { bidderSettings } from './bidderSettings';

const logger: Moli.MoliLogger = {
  debug(message?: any, ...optionalParams: any[]): void {
    window.console.log(`[publisher-example] ${message}`, ...optionalParams);
  },
  info(message?: any, ...optionalParams: any[]): void {
    window.console.log(`[publisher-example] ${message}`, ...optionalParams);
  },
  warn(message?: any, ...optionalParams: any[]): void {
    window.console.log(`[publisher-example] ${message}`, ...optionalParams);
  },
  error(message?: any, ...optionalParams: any[]): void {
    window.console.log(`[publisher-example] ${message}`, ...optionalParams);
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

export const adConfiguration: Moli.MoliConfig = {
  slots: [
    {
      position: 'in-page',
      domId: 'eager-loading-adslot',
      behaviour: 'eager',
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
      behaviour: 'eager',
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
      behaviour: 'eager',
      adUnitPath: '/33559401/gf/fragen/pos2',
      sizes: [ 'fluid', [ 605, 165 ], [ 605, 340 ], [ 1, 1 ] ],
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
            // Teads fallback placements
            teadsVerticalBid(94142, 101939, [ 'desktop', 'testfrage' ]),
            teadsVerticalBid(94140, 101937, [ 'mobile', 'testfrage' ])
          ]
        }
      },
      sizeConfig: [
        {
          mediaQuery: '(min-width: 768px)',
          sizesSupported: [ 'fluid', [ 605, 165 ], [ 605, 340 ], [ 1, 1 ] ]
        }
      ]
    },
    {
      position: 'in-page',
      domId: 'a9-adslot',
      behaviour: 'eager',
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

    // outstream only
    // see http://prebid.org/examples/video/outstream/outstream-dfp.html
    {
      position: 'in-page',
      domId: 'appNexus-outstream-adSlot',
      behaviour: 'eager',
      // AppNexus adunit path, which doesn't work because the key-value targeting is different
      // adUnitPath: '/19968336/prebid_outstream_adunit_1',
      adUnitPath: '/33559401/gf/fragen/pos2',
      sizes: [ [ 640, 480 ], [ 1, 1 ] ],
      prebid: {
        adUnit: {
          code: 'appNexus-outstream-adSlot',
          mediaTypes: {
            video: {
              context: 'outstream',
              playerSize: [ 640, 480 ]
            }
          },
          bids: [
            {
              bidder: prebidjs.AppNexusAst,
              params: {
                placementId: '13232385',
                video: {
                  skippable: true,
                  playback_method: [ 'auto_play_sound_off' ]
                }
              }
            }
          ]
        }
      },
      sizeConfig: [
        {
          mediaQuery: '(min-width: 768px)',
          sizesSupported: [ [ 640, 480 ], [ 1, 1 ] ]
        }
      ]
    },
    // multi format
    // see http://prebid.org/examples/multi_format_example.html
    {
      position: 'in-page',
      domId: 'appNexus-multiformat-adSlot',
      behaviour: 'eager',
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
            {
              bidder: prebidjs.AppNexusAst,
              params: {
                placementId: '13232392',
                video: {
                  skippable: true,
                  playback_method: [ 'auto_play_sound_off' ]
                }
              }
            }
          ]
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
    }
  },
  sizeConfig: [
    {
      labels: [ 'mobile' ],
      sizesSupported: [],
      mediaQuery: '(max-width: 767px)'
    },
    {
      labels: [ 'desktop', 'tablet' ],
      sizesSupported: [],
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
          // pubmatic wants to sync via an iframe, because they aren't able to put the relevant information into a single image call -.-
          iframe: {
            bidders: [ prebidjs.PubMatic ],
            filter: 'include'
          },
          // by default, prebid enables the image sync for all SSPs. We make it explicit here.
          image: {
            bidders: [ '*' ],
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
        singleRequest: true
      }
    }
  },
  a9: {
    timeout: 1000,
    cmpTimeout: 500,
    pubID: 'test'
  },
  consent: {
    personalizedAds: {
      provider: 'static',
      value: 0
    }
  },
  logger: logger
};
