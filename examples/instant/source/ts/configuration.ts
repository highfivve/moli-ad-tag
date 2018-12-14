import { Moli } from 'moli-ad-tag/source/ts/types/moli';
import { prebidjs } from 'moli-ad-tag/source/ts/types/prebidjs';
import { consoleLogReporter } from './reporters';

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
    return typeof value === 'string' ? [ value ] : value;
  }
  return fallback;
};

export const adConfiguration: Moli.MoliConfig = {
  slots: [
    {
      position: 'in-page',
      domId: 'eager-loading-adslot',
      behaviour: 'eager',
      adUnitPath: '/33559401/gf/fragen/RelatedContentStream',
      sizes: [ 'fluid', [ 605, 165 ], [ 605, 340 ], [ 1, 1 ] ]
    },
    {
      position: 'in-page',
      domId: 'refreshable-adslot',
      behaviour: 'refreshable',
      trigger: {
        name: 'event',
        event: 'slot.refresh',
        source: window
      },
      adUnitPath: '/33559401/gf/fragen/RelatedContentStream2',
      sizes: [ 'fluid', [ 605, 165 ], [ 605, 340 ], [ 1, 1 ] ]
    },
    {
      position: 'in-page',
      domId: 'lazy-adslot',
      behaviour: 'lazy',
      trigger: {
        name: 'event',
        event: 'timer.complete'
      },
      adUnitPath: '/33559401/gf/fragen/BusinessProfil_300x250',
      sizes: [ 'fluid', [ 300, 250 ], [ 1, 1 ] ],
      // example for a dynamic prebid configuration
      prebid: (context) => {
        return {
          adUnit: {
            code: 'lazy-adslot',
            mediaTypes: {
              banner: {
                sizes: [ [ 300, 250 ] ]
              }
            },
            bids: [
              {
                bidder: prebidjs.ImproveDigital,
                placementCode: 'sidebar-2',
                params: {
                  placementId: 1160064,
                  keyValues: {
                    category: asArray(context.keyValues.channel, [ '' ])
                  }
                }
              }
            ]
          }
        };
      }
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
            video: {
              context: 'outstream',
              playerSize: [ 605, 340 ]
            }
          },
          bids: [
            {
              bidder: prebidjs.AppNexusAst,
              params: {
                placementId: '13906537',
                video: {
                  /** This must match the configuration in the app nexus ui */
                  frameworks: [ 1, 2 ]
                }
              }
            },
            {
              bidder: prebidjs.AppNexusAst,
              params: {
                placementId: '13970743',
                video: {
                  /** This must match the configuration in the app nexus ui */
                  frameworks: [ 1, 2 ]
                }
              }
            }
          ]
        }
      }
    },
    {
      position: 'in-page',
      domId: 'a9-adslot',
      behaviour: 'lazy',
      trigger:
        {
          name: 'event',
          event: ''
        },
      adUnitPath: '/33559401/gf/fragen/RelatedContentStream3',
      sizes: [ 'fluid', [ 605, 165 ], [ 605, 340 ], [ 1, 1 ] ],
      a9: {
        enabled: true
      }
    }
  ],
  targeting: {
    keyValues: {
      isAdult: 'false',
      tags: [ 'auto', 'waschanlage' ],
      vertical: 'frag-muki.de'
    },
    labels: [ 'frag-muki.de', 'appnexusAst', 'ix' ]
  },
  sizeConfig: [
    {
      mediaQuery: '(max-width: 767px)',
      labels: [ 'mobile' ],
      sizesSupported: [ 'fluid', [ 300, 250 ], [ 300, 100 ], [ 300, 50 ], [ 1, 1 ] ]
    },
    {
      mediaQuery: '(min-width: 768px)',
      labels: [ 'desktop' ],
      sizesSupported: [ 'fluid', [ 605, 165 ], [ 605, 340 ], [ 1, 1 ] ]
    }
  ],
  prebid: {
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
            bidders: [ prebidjs.PubMatic, prebidjs.OpenX, prebidjs.SmartAdServer ],
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
      }
    }
  },
  consent: {
    personalizedAds: {
      provider: 'static',
      value: 0
    }
  },

  reporting: {
    // report everything
    sampleRate: 1,
    adUnitRegex: /\/\d*\/gf\//i,
    reporters: [
      consoleLogReporter
    ]
  },
  logger: logger
};
