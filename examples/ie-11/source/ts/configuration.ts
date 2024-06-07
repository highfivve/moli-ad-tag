import { Moli, prebidjs } from '@highfivve/ad-tag';
import { consoleLogReporter } from './reporters';
import video = prebidjs.video;

const logger: Moli.MoliLogger = {
  debug(message?: any, ...optionalParams: any[]): void {
    window.console.debug(`[DEBUG] ${message}`, ...optionalParams);
  },
  info(message?: any, ...optionalParams: any[]): void {
    window.console.info(`[INFO] ${message}`, ...optionalParams);
  },
  warn(message?: any, ...optionalParams: any[]): void {
    window.console.warn(`[WARN] ${message}`, ...optionalParams);
  },
  error(message?: any, ...optionalParams: any[]): void {
    window.console.error(`[ERROR] ${message}`, ...optionalParams);
  }
};

// small helper to create the desired shape for improve digital
const asArray = (value: string | string[] | undefined, fallback: string[]): string[] => {
  if (value) {
    return typeof value === 'string' ? [value] : value;
  }
  return fallback;
};

const appNexusNative = (placementId: string): prebidjs.IAppNexusASTBid => {
  return {
    bidder: prebidjs.AppNexusAst,
    params: {
      placementId: placementId
    },
    labelAll: [prebidjs.AppNexusAst]
  };
};

export const adConfiguration: Moli.MoliConfig = {
  slots: [
    {
      position: 'in-page',
      domId: 'eager-loading-adslot',
      behaviour: { loaded: 'eager' },
      adUnitPath: '/33559401/gf/fragen/RelatedContentStream',
      sizes: ['fluid', [605, 165], [605, 340], [1, 1]],
      sizeConfig: []
    },
    {
      position: 'in-page',
      domId: 'prebid-adslot',
      behaviour: { loaded: 'eager' },
      adUnitPath: '/33559401/gf/fragen/pos2',
      sizes: ['fluid', [605, 165], [605, 340], [1, 1]],
      sizeConfig: [],
      prebid: {
        adUnit: {
          code: 'prebid-adslot',
          mediaTypes: {
            video: {
              context: 'outstream',
              playerSize: [605, 340],
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
                placementId: '13906537',
                video: {
                  /** This must match the configuration in the app nexus ui */
                  frameworks: [1, 2]
                }
              }
            },
            {
              bidder: prebidjs.AppNexusAst,
              params: {
                placementId: '13970743',
                video: {
                  /** This must match the configuration in the app nexus ui */
                  frameworks: [1, 2]
                }
              }
            }
          ]
        }
      }
    },
    // -------------------------
    // AppNexus Test Placements
    // -------------------------

    // native formats
    {
      position: 'in-page',
      domId: 'appnexus-native-example-1',
      behaviour: { loaded: 'eager' },
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
      behaviour: { loaded: 'eager' },
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
      }
    }
  },
  schain: {
    supplyChainStartNode: {
      asi: 'highfivve.com',
      sid: '2001',
      hp: 1
    }
  },
  reporting: {
    // report everything
    sampleRate: 1,
    adUnitRegex: /\/\d*\/gf\//i,
    reporters: [consoleLogReporter]
  },
  logger
};
