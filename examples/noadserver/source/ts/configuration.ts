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
  schain: {
    supplyChainStartNode: {
      asi: 'highfivve.com',
      sid: '2001',
      hp: 1
    }
  },
  prebid: {
    // bidderSettings: bidderSettings,
    schain: {
      nodes: []
    },
    distributionUrls: {
      es6: 'cdn.h5v.eu/prebid.js/build/dist1_es6_78/Prebid.js/build/dist/prebid.js?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=OQVKDH6RSRHZPWO8QNJ1%2F20240606%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20240606T152055Z&X-Amz-Expires=604800&X-Amz-Security-Token=eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3NLZXkiOiJPUVZLREg2UlNSSFpQV084UU5KMSIsImV4cCI6MTcxNzcyNTM4MSwicGFyZW50IjoiamVua2lucyJ9.-MoMIkxI89GPZt2NK_ZJDBduoK8nl74djxa_4rh9VoGn8n3ugrg6p4FWgtkmflHIIOMYeiIUEFjBwHIZq7C--g&X-Amz-SignedHeaders=host&versionId=8b815343-515c-434d-a166-ce011181c174&X-Amz-Signature=19cd11fa12307c8633852f67b973b9c7a9a738a79cffa3e0c361e5f7d63653a8'
    },
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
