import '../stubs/browserEnvSetup';
import { expect, use } from 'chai';
import * as sinonChai from 'sinon-chai';
import * as Sinon from 'sinon';
import { prebidjs } from '../../../source/ts/types/prebidjs';
import { apstag } from '../../../source/ts/types/apstag';
import { DfpService } from '../../../source/ts/ads/dfpService';
import { Moli } from '../../../source/ts/types/moli';
import { assetLoaderService, AssetLoadMethod } from '../../../source/ts/util/assetLoaderService';
import { cookieService } from '../../../source/ts/util/cookieService';
import { googletagStub, pubAdsServiceStub } from '../stubs/googletagStubs';
import { pbjsStub, pbjsTestConfig } from '../stubs/prebidjsStubs';
import { apstagStub, a9ConfigStub } from '../stubs/a9Stubs';
import { consentConfig, noopLogger } from '../stubs/moliStubs';

// setup sinon-chai
use(sinonChai);

// tslint:disable: no-unused-expression
describe('DfpService', () => {

  // set globals before test
  window.googletag = googletagStub;
  window.pbjs = pbjsStub;
  window.apstag = apstagStub;

  // single sandbox instance to create spies and stubs
  const sandbox = Sinon.createSandbox();

  const assetLoaderFetch = sandbox.stub(assetLoaderService, 'loadScript');

  // create a new DfpService for testing
  const newDfpService = (): DfpService => {
    return new DfpService(assetLoaderService, cookieService);
  };

  const getElementByIdStub = sandbox.stub(document, 'getElementById');

  const sleep = (timeInMs: number = 20) => new Promise(resolve => {
    setTimeout(resolve, timeInMs);
  });

  after(() => {
    // bring everything back to normal after tests
    sandbox.restore();
  });


  beforeEach(() => {
    // reset the before each test
    window.googletag = googletagStub;
    window.pbjs = pbjsStub;
    window.apstag = apstagStub;

    // by default resolve all assets
    assetLoaderFetch.resolves();

    // by default all DOM elements exist
    getElementByIdStub.returns({});
  });

  afterEach(() => {
    sandbox.reset();
  });

  describe('window initialization code', () => {

    it('should configure window.pbjs.que', () => {
      (window as any).pbjs = undefined;
      const init = newDfpService().initialize({
        slots: [],
        consent: consentConfig,
        logger: noopLogger,
        prebid: { config: pbjsTestConfig }
      });

      return sleep()
        .then(() => {
          expect(window.pbjs.que).to.be.ok;
          // resolve queue and set stub
          (window as any).pbjs.que[ 0 ]();
          window.pbjs = pbjsStub;
        })
        .then(() => init);
    });

    it('should not configure window.pbjs.que without prebid config', () => {
      (window as any).pbjs = undefined;
      const init = newDfpService().initialize({ slots: [], consent: consentConfig, logger: noopLogger });

      return sleep()
        .then(() => {
          expect(window.pbjs).to.be.undefined;
        })
        .then(() => init);

    });

    it('should configure window.apstag', () => {
      (window as any).apstag = undefined;
      const init = newDfpService().initialize({
        slots: [],
        consent: consentConfig,
        logger: noopLogger,
        a9: a9ConfigStub
      });
      return sleep()
        .then(() => {
          expect(window.apstag._Q).to.be.ok;
          expect(window.apstag.init).to.be.ok;
          expect(window.apstag.fetchBids).to.be.ok;

          expect(assetLoaderFetch).to.be.calledOnceWithExactly({
            name: 'A9',
            loadMethod: AssetLoadMethod.TAG,
            assetUrl: '//c.amazon-adsystem.com/aax2/apstag.js'
          });
        })
        .then(() => init);
    });

    it('should not configure window.apstag if no a9 is requested', () => {
      (window as any).apstag = undefined;
      const init = newDfpService().initialize({ slots: [], consent: consentConfig, logger: noopLogger });
      return sleep()
        .then(() => {
          expect(window.apstag).to.be.undefined;
          expect(assetLoaderFetch).not.called;
        })
        .then(() => init);
    });

    it('should configure window.googletag.cmd', () => {
      (window as any).googletag = undefined;
      const init = newDfpService().initialize({ slots: [], consent: consentConfig, logger: noopLogger });
      return sleep()
        .then(() => {
          expect(window.googletag.cmd).to.be.ok;
          // resolve queue and set stub
          (window as any).googletag.cmd[ 0 ]();
          window.googletag = googletagStub;
        })
        .then(() => init);
    });
  });

  describe('a9 configuration', () => {
    const initSpy = sandbox.spy(apstagStub, 'init');

    it('should init the apstag', () => {
      return newDfpService().initialize({
          slots: [], a9: {
            pubID: 'pub-123',
            timeout: 123,
            cmpTimeout: 555,
            scriptUrl: '//foo.bar'
          },
          consent: consentConfig,
          logger: noopLogger
        }
      )
        .then(() => {
          expect(initSpy).to.be.calledOnceWithExactly({
            pubID: 'pub-123',
            adServer: 'googletag',
            gdpr: {
              cmpTimeout: 555
            }
          });

          expect(assetLoaderFetch).to.be.calledOnceWithExactly({
            name: 'A9',
            loadMethod: AssetLoadMethod.TAG,
            assetUrl: '//foo.bar'
          });
        });
    });
  });

  describe('prebid configuration', () => {

    it('should set the prebid configuration', () => {
      const pbjsSetConfigSpy = sandbox.spy(window.pbjs, 'setConfig');
      return newDfpService().initialize({
          slots: [],
          logger: noopLogger,
          consent: consentConfig,
          prebid: {
            config: pbjsTestConfig
          }
        }
      )
        .then(() => {
          expect(pbjsSetConfigSpy).to.be.calledOnceWithExactly(pbjsTestConfig);
        });
    });

    it('should set the prebid bidderSettings', () => {
      (window.pbjs as any).bidderSettings = undefined;
      const bidderSettings: prebidjs.IBidderSettings = {
        appnexusAst: {
          adserverTargeting: []
        }
      };
      return newDfpService().initialize({
          slots: [],
          logger: noopLogger,
          consent: consentConfig,
          prebid: {
            config: pbjsTestConfig,
            bidderSettings: bidderSettings
          }
        }
      )
        .then(() => {
          expect(window.pbjs.bidderSettings).not.to.be.undefined;
          expect(window.pbjs.bidderSettings).to.equal(bidderSettings);
        });
    });


    describe('prebid listeners', () => {

      const prebidAdslotConfig: Moli.headerbidding.PrebidAdSlotConfig = {
        adUnit: {
          code: 'eager-loading-adslot',
          mediaTypes: {
            banner: {
              sizes: [ [ 605, 165 ] ]
            }
          },
          bids: [ {
            bidder: prebidjs.AppNexusAst,
            params: {
              placementId: '1234'
            }
          } ]
        }
      };

      const adSlot: Moli.AdSlot = {
        position: 'in-page',
        domId: 'eager-loading-adslot',
        behaviour: 'eager',
        adUnitPath: '/123/eager',
        sizes: [ 'fluid', [ 605, 165 ] ],
        prebid: prebidAdslotConfig
      };

      it('should call the preSetTargetingForGPTAsync listener', () => {
        const listener: Moli.headerbidding.PrebidListener = {
          preSetTargetingForGPTAsync: (responseMap, timeOut, slots) => {
            return;
          }
        };

        const listenerSpy = sandbox.spy(listener, 'preSetTargetingForGPTAsync');


        return newDfpService().initialize({
            slots: [ adSlot ],
            logger: noopLogger,
            consent: consentConfig,
            prebid: {
              config: pbjsTestConfig,
              listener: listener
            }
          }
        ).then(() => {
          expect(listenerSpy).to.be.calledOnce;

          const args = listenerSpy.firstCall.args;

          expect(args[ 0 ]).to.deep.equal({}); // response map
          expect(args[ 1 ]).to.be.false; // time out

          const slotDefinitions = args[ 2 ] as Moli.SlotDefinition<Moli.AdSlot>[];
          expect(slotDefinitions).length(1);
          expect(adSlot).to.deep.equal(slotDefinitions[ 0 ].moliSlot);
        });
      });
    });

  });

  describe('ad slot registration', () => {

    const googletagDefineSlotSpy = sandbox.spy(window.googletag, 'defineSlot');
    const googletagDefineOutOfPageSlotSpy = sandbox.spy(window.googletag, 'defineOutOfPageSlot');
    const pubAdsServiceStubRefreshSpy = sandbox.spy(pubAdsServiceStub, 'refresh');

    const pbjsAddAdUnitSpy = sandbox.spy(window.pbjs, 'addAdUnits');
    const pbjsRequestBidsSpy = sandbox.spy(window.pbjs, 'requestBids');
    const pbjsSetTargetingForGPTAsyncSpy = sandbox.spy(window.pbjs, 'setTargetingForGPTAsync');

    const apstagFetchBidsSpy = sandbox.spy(window.apstag, 'fetchBids');
    const apstagSetDisplayBidsSpy = sandbox.spy(window.apstag, 'setDisplayBids');


    describe('regular slots', () => {

      it('should filter slots if not present in the DOM', () => {
        const dfpService = newDfpService();

        getElementByIdStub.returns(null);

        const adSlot: Moli.AdSlot = {
          position: 'in-page',
          domId: 'not-available',
          behaviour: 'eager',
          adUnitPath: '/123/eager',
          sizes: [ 'fluid', [ 605, 165 ] ]
        };

        return dfpService.initialize({
          slots: [ adSlot ], consent: consentConfig, logger: noopLogger
        }).then(() => {
          expect(googletagDefineSlotSpy.called).to.be.false;
        });
      });

      it('should register and refresh eagerly loaded in-page slot', () => {
        const dfpService = newDfpService();

        const adSlot: Moli.AdSlot = {
          position: 'in-page',
          domId: 'eager-loading-adslot',
          behaviour: 'eager',
          adUnitPath: '/123/eager',
          sizes: [ 'fluid', [ 605, 165 ] ]
        };

        return dfpService.initialize({
          slots: [ adSlot ], consent: consentConfig, logger: noopLogger
        }).then(() => {
          expect(googletagDefineSlotSpy).to.have.been.calledOnce;
          expect(googletagDefineSlotSpy).to.have.been.calledOnceWithExactly(adSlot.adUnitPath, adSlot.sizes, adSlot.domId);
          expect(pubAdsServiceStubRefreshSpy).to.have.been.calledOnce;
        });
      });

      it('should register and refresh eagerly loaded out-of-page slot', () => {
        const dfpService = newDfpService();

        const adSlot: Moli.AdSlot = {
          position: 'out-of-page',
          domId: 'eager-loading-out-of-page-adslot',
          behaviour: 'eager',
          adUnitPath: '/123/eager',
          sizes: []
        };

        return dfpService.initialize({
          slots: [ adSlot ], consent: consentConfig, logger: noopLogger
        }).then(() => {
          expect(googletagDefineOutOfPageSlotSpy).to.have.been.calledOnce;
          expect(googletagDefineOutOfPageSlotSpy).to.have.been.calledOnceWithExactly(adSlot.adUnitPath, adSlot.domId);
          expect(pubAdsServiceStubRefreshSpy).to.have.been.calledOnce;
        });
      });

      // ------------------
      // ----- Prebid -----
      // ------------------

      it('should add prebidjs adUnits', () => {
        const dfpService = newDfpService();

        const prebidAdslotConfig: Moli.headerbidding.PrebidAdSlotConfig = {
          adUnit: {
            code: 'eager-loading-adslot',
            mediaTypes: {
              banner: {
                sizes: [ [ 605, 165 ] ]
              }
            },
            bids: [ {
              bidder: prebidjs.AppNexusAst,
              params: {
                placementId: '1234'
              }
            } ]
          }
        };

        const adSlot: Moli.AdSlot = {
          position: 'in-page',
          domId: 'eager-loading-adslot',
          behaviour: 'eager',
          adUnitPath: '/123/eager',
          sizes: [ 'fluid', [ 605, 165 ] ],
          prebid: prebidAdslotConfig
        };

        return dfpService.initialize({
          slots: [ adSlot ],
          logger: noopLogger,
          consent: consentConfig,
          prebid: { config: pbjsTestConfig }
        }).then(() => {
          expect(pbjsAddAdUnitSpy).to.have.been.calledOnce;
          expect(pbjsAddAdUnitSpy).to.have.been.calledOnceWithExactly([ prebidAdslotConfig.adUnit ]);

          expect(pbjsRequestBidsSpy).to.have.been.calledOnce;
          expect(pbjsRequestBidsSpy).to.have.been.calledOnceWithExactly(
            Sinon.match.has('adUnitCodes', Sinon.match.array.deepEquals([ 'eager-loading-adslot' ])).and(
              Sinon.match.has('bidsBackHandler', Sinon.match.defined)
            )
          );

          expect(pbjsSetTargetingForGPTAsyncSpy).to.have.been.calledOnce;
          expect(pbjsSetTargetingForGPTAsyncSpy).to.have.been.calledOnceWithExactly(
            Sinon.match.array.deepEquals([ 'eager-loading-adslot' ])
          );
        });
      });

      it('should add prebidjs adUnits with a dynamic configuration', () => {
        const dfpService = newDfpService();

        // small helper to create the desired shape for improve digital
        const asArray = (value: string | string[] | undefined, fallback: string[]): string[] => {
          if (value) {
            return typeof value === 'string' ? [ value ] : value;
          }
          return fallback;
        };

        // define the prebidAdSlotConfig factory
        const prebidAdSlotConfig: Moli.headerbidding.PrebidAdSlotConfigProvider = (context: Moli.headerbidding.PrebidAdSlotContext) => {
          return {
            adUnit: {
              code: 'eager-loading-adslot',
              mediaTypes: {
                banner: {
                  sizes: [ [ 605, 165 ] ]
                }
              },
              bids: [ {
                bidder: prebidjs.ImproveDigital,
                params: {
                  placementId: 123,
                  keyValues: {
                    // category should be set by key-values
                    category: asArray(context.keyValues.channel, [ 'none' ]),
                    // user is unset and should use the fallback
                    user: asArray(context.keyValues.userId, [ 'none' ])
                  }
                }
              } ]
            }
          };
        };

        const adSlot: Moli.AdSlot = {
          position: 'in-page',
          domId: 'eager-loading-adslot',
          behaviour: 'eager',
          adUnitPath: '/123/eager',
          sizes: [ 'fluid', [ 605, 165 ] ],
          prebid: prebidAdSlotConfig
        };

        return dfpService.initialize({
          slots: [ adSlot ],
          logger: noopLogger,
          consent: consentConfig,
          targeting: {
            keyValues: {
              channel: 'PersonalAndFinance'
            }
          },
          prebid: { config: pbjsTestConfig }
        }).then(() => {
          expect(pbjsAddAdUnitSpy).to.have.been.calledOnce;
          expect(pbjsAddAdUnitSpy).to.have.been.calledOnceWithExactly([ {
            code: 'eager-loading-adslot',
            mediaTypes: {
              banner: {
                sizes: [ [ 605, 165 ] ]
              }
            },
            bids: [ {
              bidder: prebidjs.ImproveDigital,
              params: {
                placementId: 123,
                keyValues: {
                  category: [ 'PersonalAndFinance' ],
                  user: [ 'none' ]
                }
              }
            } ]
          } ]);
        });
      });

      // ------------------
      // ----- A9 ---------
      // ------------------

      it('should fetchBids for a9 ad slots', () => {
        const dfpService = newDfpService();

        const adSlot: Moli.AdSlot = {
          position: 'in-page',
          domId: 'eager-loading-adslot',
          behaviour: 'eager',
          adUnitPath: '/123/eager',
          sizes: [ 'fluid', [ 605, 165 ] ],
          a9: {}
        };

        return dfpService.initialize({
          slots: [ adSlot ],
          logger: noopLogger,
          consent: consentConfig,
          a9: a9ConfigStub
        }).then(() => {

          expect(apstagFetchBidsSpy).to.have.been.calledOnce;

          const fetchBidArgs = apstagFetchBidsSpy.firstCall.args;
          expect(fetchBidArgs).length(2);

          const bidConfig = fetchBidArgs[ 0 ] as apstag.IBidConfig;

          expect(bidConfig.slots).to.be.an('array');
          expect(bidConfig.slots).length(1);
          expect(bidConfig.slots[ 0 ].slotID).to.equal('eager-loading-adslot');
          expect(bidConfig.slots[ 0 ].slotName).to.equal('/123/eager');
          expect(bidConfig.slots[ 0 ].sizes).to.deep.equal([ [ 605, 165 ] ]);
          expect(bidConfig.timeout).to.equal(666);

          expect(fetchBidArgs[ 1 ]).to.be.a('function');

          expect(apstagSetDisplayBidsSpy).to.have.been.calledOnce;
        });
      });
    });


    describe('lazy slots', () => {

      it('should register and refresh lazy loaded slot based on event', () => {
        const dfpService = newDfpService();

        const adSlot: Moli.AdSlot = {
          position: 'in-page',
          domId: 'lazy-loading-adslot',
          behaviour: 'lazy',
          adUnitPath: '/123/lazy',
          sizes: [ [ 605, 340 ] ],
          trigger: {
            name: 'event',
            event: 'slot-trigger'
          }
        };

        return dfpService.initialize({
          slots: [ adSlot ], consent: consentConfig, logger: noopLogger
        }).then(() => {
          expect(googletagDefineSlotSpy).to.have.not.been.called;
          expect(pubAdsServiceStubRefreshSpy).to.have.been.calledOnceWithExactly([]);
        }).then(() => {
          window.dispatchEvent(new Event('slot-trigger'));
          return sleep();
        }).then(() => {
          expect(googletagDefineSlotSpy).to.have.been.calledOnceWithExactly(adSlot.adUnitPath, adSlot.sizes, adSlot.domId);
          expect(googletagDefineSlotSpy).to.have.been.called;
          const adSlotArray = pubAdsServiceStubRefreshSpy.secondCall.lastArg;
          expect(adSlotArray).length(1);
        });
      });

      it('should initPrebid for lazy loaded slot based on event', () => {
        const dfpService = newDfpService();

        const prebidAdslotConfig: Moli.headerbidding.PrebidAdSlotConfig = {
          adUnit: {
            code: 'lazy-loading-adslot',
            mediaTypes: {
              banner: {
                sizes: [ [ 605, 165 ] ]
              }
            },
            bids: [ {
              bidder: prebidjs.AppNexusAst,
              params: {
                placementId: '1234'
              }
            } ]
          }
        };

        const adSlot: Moli.AdSlot = {
          position: 'in-page',
          domId: 'lazy-loading-adslot',
          behaviour: 'lazy',
          adUnitPath: '/123/lazy',
          sizes: [ [ 605, 340 ] ],
          prebid: prebidAdslotConfig,
          trigger: {
            name: 'event',
            event: 'slot-trigger'
          }
        };

        return dfpService.initialize({
          slots: [ adSlot ], prebid: { config: pbjsTestConfig }, consent: consentConfig, logger: noopLogger
        }).then(() => {
          expect(googletagDefineSlotSpy).to.have.not.been.called;
          expect(pubAdsServiceStubRefreshSpy).to.have.been.calledOnceWithExactly([]);
        }).then(() => {
          window.dispatchEvent(new Event('slot-trigger'));
          return sleep();
        }).then(() => {
          expect(googletagDefineSlotSpy).to.have.been.calledOnceWithExactly(adSlot.adUnitPath, adSlot.sizes, adSlot.domId);
          expect(googletagDefineSlotSpy).to.have.been.called;
          const adSlotArray = pubAdsServiceStubRefreshSpy.secondCall.lastArg;
          expect(adSlotArray).length(1);

          expect(pbjsAddAdUnitSpy).to.have.been.calledOnce;
          expect(pbjsAddAdUnitSpy).to.have.been.calledOnceWithExactly([ prebidAdslotConfig.adUnit ]);

          expect(pbjsRequestBidsSpy).to.have.been.calledOnce;
          expect(pbjsRequestBidsSpy).to.have.been.calledOnceWithExactly(
            Sinon.match.has('adUnitCodes', Sinon.match.array.deepEquals([ 'lazy-loading-adslot' ])).and(
              Sinon.match.has('bidsBackHandler', Sinon.match.defined)
            )
          );

          expect(pbjsSetTargetingForGPTAsyncSpy).to.have.been.calledOnce;
          expect(pbjsSetTargetingForGPTAsyncSpy).to.have.been.calledOnceWithExactly(
            Sinon.match.array.deepEquals([ 'lazy-loading-adslot' ])
          );
        });
      });

      it('should fetchBids for a9 lazy ad slots', () => {
        const dfpService = newDfpService();

        const adSlot: Moli.AdSlot = {
          position: 'in-page',
          domId: 'lazy-loading-adslot',
          behaviour: 'lazy',
          adUnitPath: '/123/lazy',
          sizes: [ [ 605, 340 ] ],
          a9: {},
          trigger: {
            name: 'event',
            event: 'slot-trigger'
          }
        };


        return dfpService.initialize({
          slots: [ adSlot ],
          logger: noopLogger,
          consent: consentConfig,
          a9: a9ConfigStub
        }).then(() => {
          expect(googletagDefineSlotSpy).to.have.not.been.called;
          expect(pubAdsServiceStubRefreshSpy).to.have.been.calledOnceWithExactly([]);
        }).then(() => {
          window.dispatchEvent(new Event('slot-trigger'));
          return sleep();
        }).then(() => {

          expect(apstagFetchBidsSpy).to.have.been.calledOnce;

          const fetchBidArgs = apstagFetchBidsSpy.firstCall.args;
          expect(fetchBidArgs).length(2);

          const bidConfig = fetchBidArgs[ 0 ] as apstag.IBidConfig;

          expect(bidConfig.slots).to.be.an('array');
          expect(bidConfig.slots).length(1);
          expect(bidConfig.slots[ 0 ].slotID).to.equal('lazy-loading-adslot');
          expect(bidConfig.slots[ 0 ].slotName).to.equal('/123/lazy');
          expect(bidConfig.slots[ 0 ].sizes).to.deep.equal([ [ 605, 340 ] ]);
          expect(bidConfig.timeout).to.equal(666);

          expect(fetchBidArgs[ 1 ]).to.be.a('function');

          expect(apstagSetDisplayBidsSpy).to.have.been.calledOnce;
        });
      });

    });

    describe('refreshable slots', () => {

      it('should register and refresh refreshable slot based on event', () => {
        const dfpService = newDfpService();

        const adSlot: Moli.AdSlot = {
          position: 'in-page',
          domId: 'refreshable-adslot',
          behaviour: 'refreshable',
          adUnitPath: '/123/refreshable',
          sizes: [ [ 605, 340 ] ],
          trigger: {
            name: 'event',
            event: 'slot-trigger'
          }
        };

        return dfpService.initialize({
          slots: [ adSlot ], consent: consentConfig, logger: noopLogger
        }).then(() => {
          expect(googletagDefineSlotSpy).to.have.been.calledOnce;
          expect(googletagDefineSlotSpy).to.have.been.calledOnceWithExactly(adSlot.adUnitPath, adSlot.sizes, adSlot.domId);
          const adSlotArray = pubAdsServiceStubRefreshSpy.firstCall.lastArg;
          expect(adSlotArray).length(1);
        }).then(() => {
          window.dispatchEvent(new Event('slot-trigger'));
          return sleep();
        }).then(() => {
          expect(googletagDefineSlotSpy).to.have.been.calledOnce;
          const adSlotArray = pubAdsServiceStubRefreshSpy.secondCall.lastArg;
          expect(adSlotArray).length(1);
        });
      });

      it('should initPrebid for refreshable slot based on event', () => {
        const dfpService = newDfpService();

        const prebidAdslotConfig: Moli.headerbidding.PrebidAdSlotConfig = {
          adUnit: {
            code: 'refreshable-adslot',
            mediaTypes: {
              banner: {
                sizes: [ [ 605, 165 ] ]
              }
            },
            bids: [ {
              bidder: prebidjs.AppNexusAst,
              params: {
                placementId: '1234'
              }
            } ]
          }
        };

        const adSlot: Moli.AdSlot = {
          position: 'in-page',
          domId: 'refreshable-adslot',
          behaviour: 'refreshable',
          adUnitPath: '/123/refreshable',
          sizes: [ [ 605, 340 ] ],
          prebid: prebidAdslotConfig,
          trigger: {
            name: 'event',
            event: 'slot-trigger'
          }
        };

        return dfpService.initialize({
          slots: [ adSlot ], prebid: { config: pbjsTestConfig }, consent: consentConfig, logger: noopLogger
        }).then(() => {
          expect(pbjsAddAdUnitSpy).to.have.been.calledOnce;
          expect(pbjsAddAdUnitSpy).to.have.been.calledOnceWithExactly([ prebidAdslotConfig.adUnit ]);

          expect(pbjsRequestBidsSpy).to.have.been.calledOnce;
          expect(pbjsRequestBidsSpy).to.have.been.calledOnceWithExactly(
            Sinon.match.has('adUnitCodes', Sinon.match.array.deepEquals([ 'refreshable-adslot' ])).and(
              Sinon.match.has('bidsBackHandler', Sinon.match.defined)
            )
          );

          expect(pbjsSetTargetingForGPTAsyncSpy).to.have.been.calledOnce;
          expect(pbjsSetTargetingForGPTAsyncSpy).to.have.been.calledOnceWithExactly(
            Sinon.match.array.deepEquals([ 'refreshable-adslot' ])
          );

        }).then(() => {
          window.dispatchEvent(new Event('slot-trigger'));
          return sleep();
        }).then(() => {
          expect(googletagDefineSlotSpy).to.have.been.calledOnceWithExactly(adSlot.adUnitPath, adSlot.sizes, adSlot.domId);
          expect(googletagDefineSlotSpy).to.have.been.called;
          const adSlotArray = pubAdsServiceStubRefreshSpy.secondCall.lastArg;
          expect(adSlotArray).length(1);

          expect(pbjsAddAdUnitSpy).to.have.been.calledOnce;
          expect(pbjsAddAdUnitSpy).to.have.been.calledOnceWithExactly([ prebidAdslotConfig.adUnit ]);

          expect(pbjsRequestBidsSpy).to.have.been.calledTwice;
          expect(pbjsRequestBidsSpy).to.have.been.calledWith(
            Sinon.match.has('adUnitCodes', Sinon.match.array.deepEquals([ 'refreshable-adslot' ])).and(
              Sinon.match.has('bidsBackHandler', Sinon.match.defined)
            )
          );

          expect(pbjsSetTargetingForGPTAsyncSpy).to.have.been.calledTwice;
          expect(pbjsSetTargetingForGPTAsyncSpy).to.have.been.calledWith(
            Sinon.match.array.deepEquals([ 'refreshable-adslot' ])
          );
        });
      });

      it('should fetchBids for a9 refreshable ad slots', () => {
        const dfpService = newDfpService();

        const adSlot: Moli.AdSlot = {
          position: 'in-page',
          domId: 'refreshable-adslot',
          behaviour: 'refreshable',
          adUnitPath: '/123/refreshable',
          sizes: [ [ 605, 340 ] ],
          a9: {},
          trigger: {
            name: 'event',
            event: 'slot-trigger'
          }
        };

        return dfpService.initialize({
          slots: [ adSlot ],
          logger: noopLogger,
          consent: consentConfig,
          a9: a9ConfigStub
        }).then(() => {
          expect(apstagFetchBidsSpy).to.have.been.calledOnce;

          const fetchBidArgs = apstagFetchBidsSpy.firstCall.args;
          expect(fetchBidArgs).length(2);

          const bidConfig = fetchBidArgs[ 0 ] as apstag.IBidConfig;

          expect(bidConfig.slots).to.be.an('array');
          expect(bidConfig.slots).length(1);
          expect(bidConfig.slots[ 0 ].slotID).to.equal('refreshable-adslot');
          expect(bidConfig.slots[ 0 ].slotName).to.equal('/123/refreshable');
          expect(bidConfig.slots[ 0 ].sizes).to.deep.equal([ [ 605, 340 ] ]);
          expect(bidConfig.timeout).to.equal(666);

          expect(fetchBidArgs[ 1 ]).to.be.a('function');

          expect(apstagSetDisplayBidsSpy).to.have.been.calledOnce;

        }).then(() => {
          window.dispatchEvent(new Event('slot-trigger'));
          return sleep();
        }).then(() => {

          expect(apstagFetchBidsSpy).to.have.been.calledTwice;

          const fetchBidArgs = apstagFetchBidsSpy.secondCall.args;
          expect(fetchBidArgs).length(2);

          const bidConfig = fetchBidArgs[ 0 ] as apstag.IBidConfig;

          expect(bidConfig.slots).to.be.an('array');
          expect(bidConfig.slots).length(1);
          expect(bidConfig.slots[ 0 ].slotID).to.equal('refreshable-adslot');
          expect(bidConfig.slots[ 0 ].slotName).to.equal('/123/refreshable');
          expect(bidConfig.slots[ 0 ].sizes).to.deep.equal([ [ 605, 340 ] ]);
          expect(bidConfig.timeout).to.equal(666);

          expect(fetchBidArgs[ 1 ]).to.be.a('function');

          expect(apstagSetDisplayBidsSpy).to.have.been.calledTwice;
        });
      });

    });


  });

  describe('setting key/value pairs', () => {

    beforeEach(() => {
      window.googletag = googletagStub;
      window.pbjs = pbjsStub;
    });

    it('should set correct targeting values', () => {
      const dfpService = newDfpService();
      const setTargetingStub = sandbox.stub(window.googletag.pubads(), 'setTargeting');

      const adConfiguration: Moli.MoliConfig = {
        slots: [],
        logger: noopLogger,
        consent: consentConfig,
        targeting: {
          keyValues: {
            'gfversion': [ 'v2016' ],
            'sprechstunde': 'true',
            'undefined': undefined
          }
        },
        sizeConfig: []
      };

      return dfpService.initialize(adConfiguration)
        .then(() => {
          expect(setTargetingStub).to.be.calledTwice;
          expect(setTargetingStub).to.be.calledWith('gfversion', Sinon.match.array.deepEquals([ 'v2016' ]));
          expect(setTargetingStub).to.be.calledWith('sprechstunde', 'true');
          expect(setTargetingStub).not.to.be.calledWith('undefined', undefined);
        });
    });
  });

  describe('consent management', () => {

    const setNonPersonalizedAdsSpy = sandbox.spy(pubAdsServiceStub, 'setRequestNonPersonalizedAds');

    it('should setNonPersonalizedAds based on the consent configuration', () => {
      return newDfpService().initialize({
        slots: [],
        consent: consentConfig,
        logger: noopLogger
      }).then(() => {
        expect(setNonPersonalizedAdsSpy).to.be.calledOnce;
        expect(setNonPersonalizedAdsSpy).to.be.calledOnceWithExactly(0);
      });
    });

  });
});

// tslint:enable
