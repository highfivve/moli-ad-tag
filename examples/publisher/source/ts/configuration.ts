import { Moli, prebidjs, prebidOutstreamRenderer, extractAdTagVersion } from '@highfivve/ad-tag';
import video = prebidjs.video;

const { currentVersion } = require('../../version.json');

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

const appNexusOutstream = (placementId: string, floorPrice?: number): prebidjs.IAppNexusASTBid => {
  return {
    bidder: prebidjs.AppNexusAst,
    params: {
      placementId: placementId,
      video: { playback_method: ['auto_play_sound_off'] },
      ...(floorPrice ? { reserve: floorPrice } : {})
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

export const adConfiguration = (moliVersion: string): Moli.MoliConfig => ({
  consent: {
    disableLegitimateInterest: true
  },
  domain: 'gutefrage.net',
  slots: [
    {
      domId: 'ad-content-1',
      position: 'in-page',
      labelAny: ['mobile', 'desktop'],
      adUnitPath: '/55155651/prebid_test/ad-content-1/{device}/{domain}',
      sizes: [[300, 300]],
      sizeConfig: [
        {
          mediaQuery: '(min-width: 0px)',
          labelAll: ['this-label-has-to-be-there'],
          labelNone: ['this-label-cannot-be-there'],
          sizesSupported: [[300, 300]]
        }
      ],
      behaviour: {
        loaded: 'eager'
      },
      gpt: {
        // prevent collapsing this div because it hurts the CLS score
        collapseEmptyDiv: false
      },
      a9: {
        labelAll: ['a9']
      },
      prebid: context => [
        {
          adUnit: {
            pubstack: {
              adUnitName: 'ad-content-1'
            },
            mediaTypes: {
              banner: {
                sizes: [[300, 250]]
              }
            },
            ortb2Imp: {
              ext: {
                prebid: {
                  storedrequest: {
                    id: `/55155651/prebid_test/ad-content-1/{device}/{domain}`
                  }
                }
              }
            },
            bids: [
              // Unruly test placement
              unrulyBid(1081534, '6f15e139-5f18-49a1-b52f-87e5e69ee65e'),
              // SpotX test placement
              spotxBid('85394', 'ad-content-1'),
              // Teads fallback placements
              teadsVerticalBid(94142, 101939, ['desktop']),
              teadsVerticalBid(94140, 101937, ['mobile'])
            ]
          }
        }
      ]
    },
    {
      domId: 'ad-mobile-sticky',
      adUnitPath: '/55155651/mobile-sticky/{device}-{domain}',
      position: 'in-page',
      behaviour: { loaded: 'manual' },
      labelAll: ['mobile'],
      sizes: ['fluid', [300, 50], [320, 50]],
      sizeConfig: [
        {
          mediaQuery: '(max-width: 767px)',
          sizesSupported: ['fluid', [300, 50], [320, 50]]
        }
      ]
    },
    {
      domId: 'ad-desktop-sticky',
      adUnitPath: '/55155651/floorad/{device}-{category}',
      position: 'in-page',
      behaviour: { loaded: 'eager' },
      labelAll: ['desktop'],
      sizes: [
        [728, 90],
        [800, 250],
        [900, 250],
        [970, 250]
      ],
      sizeConfig: [
        {
          mediaQuery: '(min-width: 767px)',
          sizesSupported: [[728, 90]]
        },
        {
          mediaQuery: '(min-width: 800px)',
          sizesSupported: [[800, 250]]
        },
        {
          mediaQuery: '(min-width: 900px)',
          sizesSupported: [[900, 250]]
        },
        {
          mediaQuery: '(min-width: 970px)',
          sizesSupported: [[970, 250]]
        }
      ]
    },
    {
      domId: 'ad-mobile-sticky',
      adUnitPath: '/55155651/mobile-sticky/{device}-{domain}',
      position: 'in-page',
      behaviour: { loaded: 'manual' },
      labelAll: ['mobile'],
      sizes: ['fluid', [300, 50], [320, 50]],
      sizeConfig: [
        {
          mediaQuery: '(max-width: 767px)',
          sizesSupported: ['fluid', [300, 50], [320, 50]]
        }
      ]
    },
    {
      domId: 'ad-floorad',
      adUnitPath: '/55155651/floorad/{device}-{category}',
      position: 'in-page',
      behaviour: { loaded: 'eager' },
      labelAll: ['desktop'],
      sizes: [
        [728, 90],
        [800, 250],
        [900, 250],
        [970, 250]
      ],
      sizeConfig: [
        {
          mediaQuery: '(min-width: 767px)',
          sizesSupported: [[728, 90]]
        },
        {
          mediaQuery: '(min-width: 800px)',
          sizesSupported: [[800, 250]]
        },
        {
          mediaQuery: '(min-width: 900px)',
          sizesSupported: [[900, 250]]
        },
        {
          mediaQuery: '(min-width: 970px)',
          sizesSupported: [[970, 250]]
        }
      ]
    },
    {
      domId: 'eager-loading-adslot',
      position: 'in-page',
      behaviour: { loaded: 'eager' },
      adUnitPath: '/55155651/test-ad-unit/{device}-{domain}',
      sizes: ['fluid', [300, 250], [300, 600], [728, 90], [970, 250]],
      sizeConfig: [
        {
          mediaQuery: '(max-width: 767px)',
          sizesSupported: ['fluid', [300, 250], [300, 600]]
        },
        {
          mediaQuery: '(min-width: 768px)',
          sizesSupported: ['fluid', [728, 90]]
        },
        {
          mediaQuery: '(min-width: 970px)',
          sizesSupported: ['fluid', [970, 250]]
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
      sizes: [
        [605, 165],
        [605, 340],
        [640, 480],
        [1, 1]
      ],
      prebid: context => {
        return {
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
                ],
                mimes: ['video/mp4', 'video/MPV', 'video/H264', 'video/webm', 'video/ogg'],
                startdelay: 1,
                minduration: 1,
                maxduration: 30,
                playbackmethod: [
                  video.PlaybackMethod.AutoPlaySoundOff,
                  video.PlaybackMethod.ClickToPlay,
                  video.PlaybackMethod.MousOver,
                  video.PlaybackMethod.InViewportSoundsOff,
                  video.PlaybackMethod.InViewportSoundsOn
                ],
                placement: video.Placement.InBanner,
                plcmt: video.Plcmt.NoContentStandalone,
                api: [
                  video.Api.VPAID_1,
                  video.Api.VPAID_2,
                  video.Api.MRAID_1,
                  video.Api.MRAID_2,
                  video.Api.MRAID_3,
                  video.Api.ORMMA
                ],
                protocols: [
                  video.Protocol.VAST_1,
                  video.Protocol.VAST_1_WRAPPER,
                  video.Protocol.VAST_2,
                  video.Protocol.VAST_2_WRAPPER,
                  video.Protocol.VAST_3,
                  video.Protocol.VAST_3_WRAPPER,
                  video.Protocol.VAST_4,
                  video.Protocol.VAST_4_WRAPPER
                ],
                skip: video.Skip.YES,
                // Use Moli's outstream player
                renderer: { ...prebidOutstreamRenderer('prebid-adslot'), backupOnly: false }
              }
            },
            bids: [
              // Unruly test placement
              unrulyBid(1081534, '6f15e139-5f18-49a1-b52f-87e5e69ee65e'),
              // SpotX test placement
              spotxBid('85394', 'prebid-adslot'),
              // Teads fallback placements
              teadsVerticalBid(94142, 101939, ['desktop']),
              teadsVerticalBid(94140, 101937, ['mobile']),
              // AppNexus Test Placement - outstream only
              // see http://prebid.org/examples/video/outstream/outstream-dfp.html
              appNexusOutstream('13232385', context.floorPrice)
            ]
          }
        };
      },
      sizeConfig: [
        {
          mediaQuery: '(min-width: 768px)',
          sizesSupported: [
            [605, 165],
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

    {
      position: 'in-page',
      domId: 'a9-adslot',
      behaviour: { loaded: 'eager' },
      adUnitPath: '/55155651/amazon-tam',
      sizes: [[300, 250]],
      a9: {
        labelAll: ['a9', 'desktop']
      },
      sizeConfig: [
        {
          mediaQuery: '(min-width: 768px)',
          sizesSupported: ['fluid', [605, 165], [1, 1]]
        },
        {
          mediaQuery: '(max-width: 767px)',
          sizesSupported: ['fluid', [300, 250], [12, 1213]]
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
      sizes: [[1, 1], [300, 250], [300, 600], 'fluid'],
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
          sizesSupported: [[1, 1], [300, 250], [300, 600], 'fluid']
        }
      ]
    },
    {
      position: 'in-page',
      domId: 'appnexus-native-example-2',
      behaviour: { loaded: 'eager', bucket: 'ONE' },
      // adUnitPath: '/19968336/prebid_native_example_2',
      adUnitPath: '/55155651/prebid_native_2',
      sizes: [[1, 1], [300, 250], [300, 600], 'fluid'],
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
          sizesSupported: [[1, 1], [300, 250], [300, 600], 'fluid']
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

    // lazy-load
    {
      domId: 'lazy-loading-adslot-1',
      position: 'in-page',
      behaviour: {
        loaded: 'manual'
      },
      adUnitPath: '/55155651/prebid_test',
      sizes: [[300, 300]],
      passbackSupport: true,
      sizeConfig: [
        {
          mediaQuery: '(min-width: 0px)',
          sizesSupported: [[300, 300]]
        }
      ]
    },
    {
      domId: 'lazy-loading-adslot-2',
      position: 'in-page',
      behaviour: {
        loaded: 'manual'
      },
      adUnitPath: '/55155651/prebid_test',
      sizes: [[300, 300]],
      passbackSupport: true,
      sizeConfig: [
        {
          mediaQuery: '(min-width: 0px)',
          sizesSupported: [[300, 300]]
        }
      ]
    },

    // Buckets
    {
      domId: 'same-bucket1',
      position: 'in-page',
      behaviour: {
        loaded: 'manual',
        bucket: 'bucket-one'
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
      domId: 'same-bucket2',
      position: 'in-page',
      behaviour: {
        loaded: 'manual',
        bucket: 'bucket-one'
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

    // Lazy buckets
    {
      domId: 'lazy-bucket1',
      position: 'in-page',
      behaviour: {
        loaded: 'manual',
        bucket: 'lazy-bucket'
      },
      adUnitPath: '/55155651/prebid_test',
      sizes: [[300, 300]],
      passbackSupport: true,
      sizeConfig: [
        {
          mediaQuery: '(min-width: 0px)',
          sizesSupported: [[300, 300]]
        }
      ]
    },
    {
      domId: 'lazy-bucket2',
      position: 'in-page',
      behaviour: {
        loaded: 'manual',
        bucket: 'lazy-bucket'
      },
      adUnitPath: '/55155651/prebid_test',
      sizes: [[300, 300]],
      passbackSupport: true,
      sizeConfig: [
        {
          mediaQuery: '(min-width: 0px)',
          sizesSupported: [[300, 300]]
        }
      ]
    },
    {
      domId: 'lazy-bucket3',
      position: 'in-page',
      behaviour: {
        loaded: 'manual',
        bucket: 'lazy-bucket'
      },
      adUnitPath: '/55155651/prebid_test',
      sizes: [[300, 300]],
      passbackSupport: true,
      sizeConfig: [
        {
          mediaQuery: '(min-width: 0px)',
          sizesSupported: [[300, 300]]
        }
      ]
    },

    // infinite loading
    {
      domId: 'infinite-loading-adslot',
      position: 'in-page',
      behaviour: {
        loaded: 'infinite',
        selector: '.ad-infinite'
      },
      adUnitPath: '/55155651/prebid_test',
      sizes: [[300, 300]],
      passbackSupport: true,
      sizeConfig: [
        {
          mediaQuery: '(min-width: 0px)',
          sizesSupported: [[300, 300]]
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
      static: 'from-config',
      pageview: '1' // getPageViewCount()
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
    enabled: true,
    bucket: {
      'bucket-one': { timeout: 5000 },
      'lazy-bucket': { timeout: 3000 }
    }
  },
  schain: {
    supplyChainStartNode: {
      asi: 'highfivve.com',
      sid: '2001',
      hp: 1
    }
  },
  prebid: {
    ephemeralAdUnits: true,
    // bidderSettings: bidderSettings,
    schain: {
      nodes: []
    },
    config: {
      s2sConfig: {
        accountId: 'publisher-mode-example',
        adapter: 'prebidServer',
        endpoint: { p1Consent: 'https://prebid-server.h5v.eu/openrtb2/auction' },
        syncEndpoint: { p1Consent: 'https://prebid-server.h5v.eu/cookie_sync' },
        bidders: [],
        enabled: true,
        timeout: 1800,
        extPrebid: {
          analytics: {
            h5v: {
              moliVersion: moliVersion,
              adTagVersion: extractAdTagVersion({ currentVersion })
            }
          }
        }
      },
      bidderTimeout: 1000,
      consentManagement: {
        gdpr: {
          timeout: 500,
          allowAuctionWithoutConsent: true
        }
      },
      floors: {
        enforcement: {
          enforceJS: false
        }
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
              expires: 60 // cookie can last for 60 days,
            }
          },
          {
            name: 'sharedId',
            params: {
              create: true,
              pixelUrl: '',
              extend: false
            },
            storage: {
              expires: 60,
              name: '_pubcid',
              type: 'cookie'
            }
          }
        ],
        encryptedSignalSources: {
          sources: [
            {
              source: ['adserver.org', 'id5-sync.com', 'criteo.com', 'liveramp.com'],
              encrypt: false
            }
          ]
        }
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
    pubID: 'test',
    schainNode: {
      asi: 'highfivve.com',
      sid: '1111111',
      hp: 1
    }
  }
});
