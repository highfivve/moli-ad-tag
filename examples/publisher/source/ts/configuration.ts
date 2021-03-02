import { Moli, prebidjs } from '@highfivve/ad-tag';
import { consoleLogReporter } from './reporters';

const teadsVerticalBid = (
  placementId: number,
  pageId: number,
  labelAll: string[]
): prebidjs.ITeadsBid => {
  return {
    bidder: prebidjs.Teads,
    params: {
      placementId: placementId,
      pageId: pageId
    },
    labelAll: [prebidjs.Teads, 'purpose-1', ...labelAll]
  };
};

const unrulyBid = (siteId: number, targetingUUID: string): prebidjs.IUnrulyBid => {
  return {
    bidder: prebidjs.Unruly,
    params: {
      siteId,
      targetingUUID
    },
    labelAll: [prebidjs.Unruly, 'purpose-1']
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
    labelAll: [prebidjs.Spotx]
  };
};

const dspxBid = (placement: string): prebidjs.IDSPXBid => {
  return {
    bidder: prebidjs.DSPX,
    params: {
      placement,
      devMode: true
    },
    labelAll: [prebidjs.DSPX, 'purpose-1']
  };
};

const appNexusOutstream = (placementId: string): prebidjs.IAppNexusASTBid => {
  return {
    bidder: prebidjs.AppNexusAst,
    params: {
      placementId: placementId,
      video: { playback_method: ['auto_play_sound_off'] }
    },
    labelAll: [prebidjs.AppNexusAst, 'purpose-1']
  };
};

const appNexusNative = (placementId: string): prebidjs.IAppNexusASTBid => {
  return {
    bidder: prebidjs.AppNexusAst,
    params: {
      placementId: placementId
    },
    labelAll: [prebidjs.AppNexusAst, 'purpose-1']
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

const ixBid = (
  siteId: string,
  size: [number, number],
  bidFloor: number | undefined
): prebidjs.IIndexExchangeBid => {
  const bidConfig: { bidFloor?: number; bidFloorCur?: 'EUR' } = bidFloor
    ? {
        bidFloor: bidFloor,
        bidFloorCur: 'EUR'
      }
    : {};
  return {
    bidder: prebidjs.IndexExchange,
    params: {
      siteId: siteId,
      size: size,
      ...bidConfig
    },
    labelAll: [prebidjs.IndexExchange]
  };
};

const rubiconBid = (
  accountId: string,
  siteId: string,
  zoneId: string,
  bidFloor: number | undefined
): prebidjs.IRubiconBid => {
  return {
    bidder: prebidjs.Rubicon,
    params: {
      accountId,
      siteId,
      zoneId,
      floor: bidFloor
    },
    labelAll: [prebidjs.Rubicon]
  };
};

export const adConfiguration: Moli.MoliConfig = {
  slots: [
    {
      domId: 'eager-loading-adslot',
      position: 'in-page',
      behaviour: { loaded: 'eager' },
      adUnitPath: '/55155651/test-ad-unit',
      sizes: ['fluid', [300, 250], [1, 1]],
      passbackSupport: true,
      sizeConfig: [
        {
          mediaQuery: '(min-width: 0px)',
          sizesSupported: ['fluid', [300, 250], [1, 1]]
        }
      ]
    },
    {
      position: 'in-page',
      domId: 'eager-loading-adslot-not-in-dom',
      behaviour: { loaded: 'eager' },
      adUnitPath: '/55155651/test-ad-unit',
      sizes: ['fluid', [300, 250], [1, 1]],
      sizeConfig: [
        {
          mediaQuery: '(min-width: 0px)',
          sizesSupported: ['fluid', [300, 250], [1, 1]]
        }
      ]
    },
    {
      position: 'in-page',
      domId: 'prebid-adslot',
      behaviour: { loaded: 'eager', bucket: 'ONE' },
      adUnitPath: '/55155651/outstream_test',
      passbackSupport: true,
      sizes: [
        [605, 165],
        [605, 340],
        [640, 480],
        [1, 1]
      ],
      prebid: [
        {
          adUnit: {
            code: 'prebid-adslot',
            pubstack: {
              adUnitPath: '/55155651/outstream_test'
            },
            mediaTypes: {
              banner: {
                sizes: [
                  [300, 50],
                  [300, 250],
                  [320, 50]
                ]
              },
              video: {
                context: 'outstream',
                playerSize: [
                  [605, 340],
                  [536, 302],
                  [1, 1]
                ]
              }
            },
            bids: [
              // Unruly test placement
              unrulyBid(1081534, '6f15e139-5f18-49a1-b52f-87e5e69ee65e'),
              // SpotX test placement
              spotxBid('85394', 'prebid-adslot'),
              // Teads fallback placements
              teadsVerticalBid(94142, 101939, ['desktop']),
              teadsVerticalBid(94140, 101937, ['mobile'])
            ]
          }
        },
        {
          adUnit: {
            code: 'prebid-adslot',
            pubstack: {
              adUnitPath: '/55155651/outstream_test'
            },
            mediaTypes: {
              banner: {
                sizes: [
                  [300, 50],
                  [300, 250],
                  [320, 50]
                ]
              },
              video: {
                context: 'outstream',
                playerSize: [
                  [605, 340],
                  [536, 302],
                  [1, 1]
                ]
              }
            },
            bids: [
              // AppNexus Test Placement - outstream only
              // see http://prebid.org/examples/video/outstream/outstream-dfp.html
              appNexusOutstream('13232385')
            ]
          }
        }
      ],
      sizeConfig: [
        {
          mediaQuery: '(min-width: 768px)',
          sizesSupported: [
            [605, 165],
            [605, 340],
            [1, 1]
          ]
        },
        {
          mediaQuery: '(min-width: 768px)',
          sizesSupported: [[640, 480]],
          labelAll: [prebidjs.AppNexusAst]
        },
        {
          mediaQuery: '(max-width: 767px)',
          sizesSupported: [[1, 1]]
        }
      ]
    },

    /* prebid banner slot*/
    {
      position: 'in-page',
      domId: 'prebid-adslot-2',
      behaviour: { loaded: 'eager', bucket: 'TWO' },
      adUnitPath: '/55155651/prebid_test',
      passbackSupport: true,
      sizes: [[300, 250]],
      prebid: context => {
        return {
          adUnit: {
            code: 'prebid-adslot-2',
            mediaTypes: {
              banner: {
                sizes: [[300, 250]]
              }
            },
            bids: [
              dspxBid('101'),
              ixBid('0', [300, 250], context.floorPrice),
              rubiconBid('14062', '70608', '498816', context.floorPrice)
            ]
          }
        };
      },
      sizeConfig: [
        {
          mediaQuery: '(min-width: 768px)',
          sizesSupported: [[300, 250]]
        }
      ]
    },

    {
      position: 'in-page',
      domId: 'a9-adslot',
      behaviour: { loaded: 'eager' },
      adUnitPath: '/55155651/amazon-tam',
      sizes: ['fluid', [300, 250]],
      a9: {
        labelAll: ['a9', 'desktop']
      },
      sizeConfig: [
        {
          mediaQuery: '(min-width: 768px)',
          sizesSupported: ['fluid', [605, 165]]
        },
        {
          mediaQuery: '(max-width: 767px)',
          sizesSupported: ['fluid', [300, 250]]
        }
      ]
    },
    // -------------------------
    // AppNexus Test Placements
    // -------------------------

    // native formats
    {
      position: 'in-page',
      domId: 'appnexus-native-example-1',
      behaviour: { loaded: 'eager', bucket: 'ONE' },
      // adUnitPath: '/19968336/prebid_native_example_1',
      adUnitPath: '/55155651/prebid_native_1',
      sizes: [[1, 1], 'fluid'],
      prebid: {
        adUnit: {
          code: 'appnexus-native-example-1',
          mediaTypes: {
            native: {
              title: { required: true },
              image: { required: true },
              clickUrl: { required: true },
              sponsoredBy: { required: true }
            }
          },
          bids: [appNexusNative('13232354')]
        }
      },
      sizeConfig: [
        {
          mediaQuery: '(min-width: 0px)',
          sizesSupported: [[1, 1], 'fluid']
        }
      ]
    },
    {
      position: 'in-page',
      domId: 'appnexus-native-example-2',
      behaviour: { loaded: 'eager', bucket: 'ONE' },
      // adUnitPath: '/19968336/prebid_native_example_2',
      adUnitPath: '/55155651/prebid_native_2',
      sizes: [[1, 1], 'fluid'],
      prebid: {
        adUnit: {
          code: 'appnexus-native-example-2',
          mediaTypes: {
            native: {
              title: { required: true },
              body: { required: true },
              clickUrl: { required: true },
              image: { required: true },
              sponsoredBy: { required: true },
              icon: { required: false }
            }
          },
          bids: [appNexusNative('13232354')]
        }
      },
      sizeConfig: [
        {
          mediaQuery: '(min-width: 0px)',
          sizesSupported: [[1, 1], 'fluid']
        }
      ]
    },

    /* lazy & refreshable */
    {
      domId: 'lazy-adslot',
      position: 'in-page',
      behaviour: {
        loaded: 'lazy',
        trigger: {
          name: 'event',
          event: 'ads.lazy-adslot',
          source: window
        }
      },
      adUnitPath: '/55155651/prebid_test',
      sizes: [[300, 250]],
      passbackSupport: true,
      sizeConfig: [
        {
          mediaQuery: '(min-width: 0px)',
          sizesSupported: [[300, 250]]
        }
      ]
    },
    {
      domId: 'refreshable-adslot',
      position: 'in-page',
      behaviour: {
        loaded: 'refreshable',
        trigger: {
          name: 'event',
          event: 'ads.refreshable-adslot',
          source: window
        }
      },
      adUnitPath: '/55155651/prebid_test',
      sizes: [[300, 250]],
      passbackSupport: true,
      sizeConfig: [
        {
          mediaQuery: '(min-width: 0px)',
          sizesSupported: [[300, 250]]
        }
      ]
    },

    /* manualy slots */
    {
      domId: 'manual-adslot',
      position: 'in-page',
      behaviour: {
        loaded: 'manual'
      },
      adUnitPath: '/55155651/prebid_test',
      sizes: [[300, 250]],
      passbackSupport: true,
      sizeConfig: [
        {
          mediaQuery: '(min-width: 0px)',
          sizesSupported: [[300, 250]]
        }
      ]
    },

    // web interstitial
    {
      domId: 'unused',
      position: 'out-of-page-interstitial',
      behaviour: {
        loaded: 'eager'
      },
      adUnitPath: '/6355419/Travel/Europe/France/Paris',
      sizes: [],
      sizeConfig: []
    }
  ],
  // -----------------------------
  // ----- standard config -------
  // -----------------------------
  targeting: {
    keyValues: {
      static: 'from-config'
    },
    labels: [
      // activate teads, spotx, appNexus and/or unruly via the label query param
    ]
  },
  labelSizeConfig: [
    {
      labelsSupported: ['mobile'],
      mediaQuery: '(max-width: 767px)'
    },
    {
      labelsSupported: ['desktop'],
      mediaQuery: '(min-width: 768px)'
    }
  ],
  buckets: {
    enabled: true
  },
  prebid: {
    // bidderSettings: bidderSettings,
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
            bidders: [prebidjs.PubMatic, prebidjs.SmartAdServer],
            filter: 'include'
          },
          // by default, prebid enables the image sync for all SSPs. We make it explicit here.
          image: {
            bidders: '*',
            filter: 'include'
          }
        },
        // user id systems
        userIds: [
          {
            name: 'unifiedId',
            params: {
              partner: 'myTpId'
            },
            storage: {
              type: 'cookie',
              name: 'pbjs-unifiedid', // create a cookie with this name
              expires: 60 // cookie can last for 60 days
            }
          }
        ]
      },
      currency: {
        adServerCurrency: 'EUR',
        granularityMultiplier: 1,
        // taken from: https://currency.prebid.org/latest.json
        defaultRates: {
          USD: {
            EUR: 0.8695652174
          }
        }
      },
      improvedigital: {
        singleRequest: true,
        usePrebidSizes: true
      },
      rubicon: {
        singleRequest: true
      }
    }
  },
  a9: {
    timeout: 1000,
    cmpTimeout: 500,
    pubID: 'test'
  },
  reporting: {
    // report everything
    sampleRate: 1,
    adUnitRegex: /\/\d*\/gf\//i,
    reporters: [consoleLogReporter]
  }
};
