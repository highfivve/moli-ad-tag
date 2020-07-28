import { Moli, prebidjs } from '@highfivve/ad-tag';

export const adConfiguration: Moli.MoliConfig = {
  environment: 'test',
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
      domId: 'ad-sidebar-1',
      adUnitPath: '/33559401/gf/fragen/Sidebar_1',
      labelAll: [ 'desktop' ],
      sizes: [ 'fluid', [ 300, 250 ], [ 120, 600 ], [ 160, 600 ], [ 200, 600 ], [ 300, 600 ] ],
      position: 'in-page',
      behaviour: {
        loaded: 'refreshable',
        lazy: true,
        trigger: {
          name: 'event',
          event: 'ads.ad-sidebar-1',
          source: window
        },
      },
      sizeConfig: [
        {
          mediaQuery: '(min-width: 768px)',
          sizesSupported: [ 'fluid', [ 300, 250 ], [ 120, 600 ], [ 160, 600 ], [ 200, 600 ], [ 300, 600 ] ]
        }
      ]
    },
    {
      position: 'in-page',
      domId: 'spa-prebid-adslot',
      behaviour: {
        loaded: 'lazy',
        trigger: {
          name: 'event',
          event: 'ads.spa-prebid-adslot',
          source: window
        },
      },
      adUnitPath: '/33559401/gf/fragen/pos2',
      sizes: [ 'fluid', [ 300, 250 ], [ 605, 165 ], [ 605, 340 ], [ 1, 1 ] ],
      prebid: {
        adUnit: {
          code: 'prebid-adslot',
          mediaTypes: {
            banner: {
              sizes: [ [ 300, 250 ] ]
            },
            video: {
              context: 'outstream',
              playerSize: [ [ 605, 340 ], [ 536, 302 ], [ 300, 169 ] ]
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
          sizesSupported: [ 'fluid', [ 300, 250 ], [ 1, 1 ] ]
        },
        {
          mediaQuery: '(min-width: 768px)',
          sizesSupported: [ 'fluid', [ 300, 250 ], [ 605, 165 ], [ 605, 340 ], [ 1, 1 ] ]
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
    }
  ],
  targeting: {
    keyValues: {
      'static': 'from-config'
    }
  },
  labelSizeConfig: [
    {
      labelsSupported: [ 'mobile' ],
      mediaQuery: '(max-width: 767px)'
    },
    {
      labelsSupported: [ 'desktop' ],
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
            bidders: [ prebidjs.PubMatic ],
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
        usePrebidSizes: true
      }
    }
  },
  a9: {
    timeout: 1000,
    cmpTimeout: 500,
    pubID: 'test'
  },
  yieldOptimization: {
    provider: 'none',
  }
};
