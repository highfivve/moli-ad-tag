import { MoliRuntime, prebidjs } from '@highfivve/ad-tag';
import video = prebidjs.video;

export const adConfiguration: MoliRuntime.MoliConfig = {
  environment: 'test',
  spa: { enabled: true, validateLocation: 'href' },
  slots: [
    {
      position: 'in-page',
      domId: 'eager-loading-adslot',
      behaviour: { loaded: 'eager' },
      adUnitPath: '/33559401/gf/fragen/RelatedContentStream',
      sizes: ['fluid', [605, 165], [605, 340], [1, 1]],
      sizeConfig: [
        {
          mediaQuery: '(min-width: 768px)',
          sizesSupported: ['fluid', [605, 165], [605, 340], [1, 1]]
        }
      ]
    },
    {
      domId: 'ad-sidebar-1',
      adUnitPath: '/33559401/gf/fragen/Sidebar_1',
      labelAll: ['desktop'],
      sizes: ['fluid', [300, 250], [120, 600], [160, 600], [200, 600], [300, 600]],
      position: 'in-page',
      behaviour: {
        loaded: 'manual'
      },
      sizeConfig: [
        {
          mediaQuery: '(min-width: 768px)',
          sizesSupported: ['fluid', [300, 250], [120, 600], [160, 600], [200, 600], [300, 600]]
        }
      ]
    },
    {
      position: 'in-page',
      domId: 'spa-prebid-adslot',
      behaviour: {
        loaded: 'manual'
      },
      adUnitPath: '/33559401/gf/fragen/pos2',
      sizes: ['fluid', [300, 250], [605, 165], [605, 340], [1, 1]],
      prebid: {
        adUnit: {
          code: 'prebid-adslot',
          mediaTypes: {
            banner: {
              sizes: [[300, 250]]
            },
            video: {
              context: 'outstream',
              playerSize: [
                [605, 340],
                [536, 302],
                [300, 169]
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
              skip: video.Skip.YES
            }
          },
          bids: [
            {
              bidder: prebidjs.AppNexusAst,
              params: {
                placementId: '13906537'
              }
            },
            {
              bidder: prebidjs.AppNexusAst,
              params: {
                placementId: '13970743'
              }
            }
          ]
        }
      },
      sizeConfig: [
        {
          mediaQuery: '(max-width: 767px)',
          sizesSupported: ['fluid', [300, 250], [1, 1]]
        },
        {
          mediaQuery: '(min-width: 768px)',
          sizesSupported: ['fluid', [300, 250], [605, 165], [605, 340], [1, 1]]
        }
      ]
    },
    {
      position: 'in-page',
      domId: 'spa-a9-adslot',
      behaviour: {
        loaded: 'manual'
      },
      adUnitPath: '/33559401/gf/fragen/RelatedContentStream3',
      sizes: ['fluid', [605, 165], [300, 250]],
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
    }
  ],
  targeting: {
    keyValues: {
      static: 'from-config'
    }
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
  schain: {
    supplyChainStartNode: {
      asi: 'highfivve.com',
      sid: '2001',
      hp: 1
    }
  },
  prebid: {
    schain: {
      nodes: []
    },
    config: {
      bidderTimeout: 1000,
      consentManagement: {
        gdpr: {
          timeout: 500,
          allowAuctionWithoutConsent: true
        }
      },
      userSync: {
        syncDelay: 6000,
        filterSettings: {
          // pubmatic wants to sync via an iframe, because they aren't able to put the relevant information into a single image call -.-
          iframe: {
            bidders: [prebidjs.PubMatic],
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
          USD: {
            EUR: 0.8695652174
          }
        }
      },
      improvedigital: {
        singleRequest: true,
        usePrebidSizes: true
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
};
