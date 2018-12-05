import { Moli } from 'moli-ad-tag/source/ts/types/moli';
import { prebidjs } from 'moli-ad-tag/source/ts/types/prebidjs';

const logger: Moli.MoliLogger = {
  debug(message?: any, ...optionalParams: any[]): void {
    window.console.log(`[lazy-init example] ${message}`, ...optionalParams);
  },
  info(message?: any, ...optionalParams: any[]): void {
    window.console.log(`[lazy-init example] ${message}`, ...optionalParams);
  },
  warn(message?: any, ...optionalParams: any[]): void {
    window.console.log(`[lazy-init example] ${message}`, ...optionalParams);
  },
  error(message?: any, ...optionalParams: any[]): void {
    window.console.log(`[lazy-init example] ${message}`, ...optionalParams);
  }

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
      domId: 'eager-loading-adslot-not-in-dom',
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
        event: 'slot.refresh'
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
      sizes: [ [ 999, 165 ] ]
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
      a9: {}
    }
  ],
  targeting: {
    keyValues: {
      'static': 'from-config'
    }
  },
  sizeConfig: [
    {
      labels: [],
      sizesSupported: [ 'fluid', [ 605, 165 ], [ 605, 340 ], [ 1, 1 ] ],
      mediaQuery: '(min-width: 400px)'
    },
    {
      labels: [ 'desktop', 'tablet' ],
      sizesSupported: [ 'fluid', [ 605, 165 ], [ 605, 340 ], [ 1, 1 ] ],
      mediaQuery: '(min-width: 768px)'
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
  logger: logger
};
