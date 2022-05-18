import { Moli, prebidjs, prebidOutstreamRenderer } from '@highfivve/ad-tag';
import video = prebidjs.video;

const appNexusOutstream = (placementId: string): prebidjs.IAppNexusASTBid => {
  return {
    bidder: prebidjs.AppNexusAst,
    params: {
      placementId: placementId,
      video: { playback_method: ['auto_play_sound_off'] }
    },
    labelAll: [prebidjs.AppNexusAst]
  };
};

const appNexus = (placementId: string): prebidjs.IAppNexusASTBid => {
  return {
    bidder: prebidjs.AppNexusAst,
    params: {
      placementId: placementId
    },
    labelAll: [prebidjs.AppNexusAst]
  };
};

const improveDigitalBid: prebidjs.IImproveDigitalBid = {
  bidder: prebidjs.ImproveDigital,
  labelAll: [prebidjs.ImproveDigital],
  params: {
    placementId: 1053687
  }
};

const rubiconBid: prebidjs.IRubiconBid = {
  bidder: prebidjs.Rubicon,
  params: {
    accountId: '14062',
    siteId: '70608',
    zoneId: '498816'
  },
  labelAll: [prebidjs.Rubicon]
};

const rubiconVideoBid: prebidjs.IRubiconBid = {
  bidder: prebidjs.Rubicon,
  params: {
    accountId: '7780',
    siteId: '87184',
    zoneId: '412394',
    video: {
      language: 'en'
    }
  },
  labelAll: [prebidjs.Rubicon]
};

export const adConfiguration: Moli.MoliConfig = {
  // <---- this configures prebid only ----->
  adServer: 'prebidjs',

  slots: [
    // content_1
    {
      domId: 'ad_content_1',
      position: 'in-page',
      behaviour: { loaded: 'eager' },
      adUnitPath: '/0/example/content_1/{device}',
      sizes: [
        [300, 250],
        [300, 600],
        [728, 90]
      ],
      sizeConfig: [
        {
          mediaQuery: '(min-width: 0px)',
          sizesSupported: [
            [300, 250],
            [300, 600],
            [728, 90]
          ]
        }
      ],
      prebid: {
        adUnit: {
          mediaTypes: {
            banner: {
              sizes: [
                [300, 250],
                [300, 600],
                [728, 90]
              ]
            }
          },
          bids: [appNexus('13144370'), improveDigitalBid, rubiconBid]
        }
      }
    },

    {
      position: 'in-page',
      domId: 'ad_content_2',
      behaviour: { loaded: 'eager' },
      adUnitPath: '/0/example/content_2/{device}',
      sizes: [
        [300, 250],
        [300, 600],
        [728, 90],
        [1, 1]
      ],
      prebid: {
        adUnit: {
          pubstack: {
            adUnitPath: '/55155651/outstream_test'
          },
          mediaTypes: {
            banner: {
              sizes: [
                [300, 50],
                [300, 250],
                [320, 50],
                [1, 1]
              ]
            },
            video: {
              context: 'outstream',
              playerSize: [[1, 1]],
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
            // AppNexus Test Placement - outstream only
            // see http://prebid.org/examples/video/outstream/outstream-dfp.html
            appNexusOutstream('13232385'),
            rubiconVideoBid
          ]
        }
      },
      sizeConfig: [
        {
          mediaQuery: '(min-width: 0px)',
          sizesSupported: [
            [300, 250],
            [300, 600],
            [728, 90],
            [1, 1]
          ]
        }
      ]
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
    enabled: false
  },
  prebid: {
    // bidderSettings: bidderSettings,
    config: {
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
  }
};
