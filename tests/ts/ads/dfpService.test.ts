import '../stubs/browserEnvSetup';
import { expect, use } from 'chai';
import * as sinonChai from 'sinon-chai';
import * as Sinon from 'sinon';
import { googletag } from '../../../source/ts';
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
  window.moliPbjs = pbjsStub;
  window.apstag = apstagStub;

  // single sandbox instance to create spies and stubs
  const sandbox = Sinon.createSandbox();

  const assetLoaderFetch = sandbox.stub(assetLoaderService, 'loadScript');
  const matchMediaStub = sandbox.stub(window, 'matchMedia');

  // googletag spies
  const googletagDefineSlotSpy = sandbox.spy(window.googletag, 'defineSlot');
  const googleTagPubAdsSpy = sandbox.spy(window.googletag, 'pubads');
  const googletagDefineOutOfPageSlotSpy = sandbox.spy(window.googletag, 'defineOutOfPageSlot');
  const pubAdsServiceStubRefreshSpy = sandbox.spy(pubAdsServiceStub, 'refresh');

  // pbjs spies
  const pbjsAddAdUnitSpy = sandbox.spy(window.pbjs, 'addAdUnits');
  const pbjsRequestBidsSpy = sandbox.spy(window.pbjs, 'requestBids');
  const pbjsSetTargetingForGPTAsyncSpy = sandbox.spy(window.pbjs, 'setTargetingForGPTAsync');

  // a9 apstag spies
  const apstagFetchBidsSpy = sandbox.spy(window.apstag, 'fetchBids');
  const apstagSetDisplayBidsSpy = sandbox.spy(window.apstag, 'setDisplayBids');

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
    getElementByIdStub.returns({} as HTMLElement);
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
          (window as any).pbjs.que[0]();
          window.pbjs = pbjsStub;
        })
        .then(() => init);
    });

    it('should configure window.moliPbjs.que if useMoliPbjs is set', () => {
      (window as any).moliPbjs = undefined;
      const init = newDfpService().initialize({
        slots: [],
        consent: consentConfig,
        logger: noopLogger,
        prebid: { config: pbjsTestConfig, useMoliPbjs: true }
      });

      return sleep()
        .then(() => {
          expect(window.moliPbjs.que).to.be.ok;
          // resolve queue and set stub
          (window as any).moliPbjs.que[0]();
          window.moliPbjs = pbjsStub;
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
          (window as any).googletag.cmd[0]();
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
            bidTimeout: 123,
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
        prebid: prebidAdslotConfig,
        sizeConfig: [
          {
            mediaQuery: '(min-width: 0px)',
            sizesSupported: [ [ 605, 165 ] ]
          }
        ]
      };

      const adSlot2: Moli.AdSlot = {
        position: 'in-page',
        domId: 'eager2-loading-adslot',
        behaviour: 'eager',
        adUnitPath: '/123/eager2',
        sizes: [ 'fluid', [ 605, 165 ] ],
        prebid: prebidAdslotConfig,
        sizeConfig: [
          {
            mediaQuery: '(min-width: 0px)',
            sizesSupported: [ [ 605, 165 ] ]
          }
        ]
      };

      it('should inject a valid PrebidListenerContext', () => {
        matchMediaStub.returns({ matches: true } as MediaQueryList);

        const listenerSpy = sandbox.spy(); // sandbox.spy(configProvider);
        const dfpService = newDfpService();

        return dfpService.initialize({
            slots: [ adSlot ],
            logger: noopLogger,
            consent: consentConfig,
            targeting: {
              keyValues: {
                'foo': 'bar'
              }
            },
            prebid: {
              config: pbjsTestConfig,
              listener: listenerSpy
            }
          }
        ).then(config => {
          return dfpService.requestAds(config);
        }).then(() => {
          expect(listenerSpy).to.be.calledOnce;

          const args = listenerSpy.firstCall.args;

          expect(args[0]).to.deep.equal({ keyValues: { 'foo': 'bar' } }); // context
        });
      });

      it('should call the preSetTargetingForGPTAsync listener', () => {
        matchMediaStub.returns({ matches: true } as MediaQueryList);

        const listener: Moli.headerbidding.PrebidListener = {
          preSetTargetingForGPTAsync: (responseMap, timeOut, slots) => {
            return;
          }
        };


        const listenerSpy = sandbox.spy(listener, 'preSetTargetingForGPTAsync');
        const dfpService = newDfpService();

        return dfpService.initialize({
            slots: [ adSlot ],
            logger: noopLogger,
            consent: consentConfig,
            prebid: {
              config: pbjsTestConfig,
              listener: listener
            }
          }
        ).then(config => {
          return dfpService.requestAds(config);
        }).then(() => {
          expect(listenerSpy).to.be.calledOnce;

          const args = listenerSpy.firstCall.args;

          expect(args[0]).to.deep.equal({}); // response map
          expect(args[1]).to.be.false; // time out

          const slotDefinitions = args[2] as Moli.SlotDefinition<Moli.AdSlot>[];
          expect(slotDefinitions).length(1);
          expect(adSlot).to.deep.equal(slotDefinitions[0].moliSlot);
        });
      });

      it('should call pbjs.triggerUserSyncs when all ads are loaded', () => {
        matchMediaStub.returns({ matches: true } as MediaQueryList);

        // record listeners added
        type SlotRenderEndedListener = (event: googletag.events.ISlotRenderEndedEvent) => void;
        const listeners: SlotRenderEndedListener[] = [];
        const adddSlotRenderEndedListener = (_eventType: 'slotRenderEnded', listener: SlotRenderEndedListener) => {
          listeners.push(listener);
          return pubAdsServiceStub;
        };

        sandbox.stub(pubAdsServiceStub, 'addEventListener')
        // force typescript to accept this overloaded definition
          .callsFake(adddSlotRenderEndedListener as any);

        const triggerUserSyncsSpy = sandbox.spy(window.pbjs, 'triggerUserSyncs');
        const dfpService = newDfpService();

        return dfpService.initialize({
            slots: [ adSlot, adSlot2 ],
            logger: noopLogger,
            consent: consentConfig,
            prebid: {
              config: {
                ...pbjsTestConfig,
                userSync: {
                  enableOverride: true
                }
              },
              userSync: 'all-ads-loaded'
            }
          }
        ).then(config => {
          return dfpService.requestAds(config);
        }).then(() => {
          // somehow trigger the slotRenderEvent
          listeners.forEach(listener => {
            [ adSlot, adSlot2 ].forEach(slot => {
              // type cast so we only need to implement the necessary properties
              const slotRenderEnded: googletag.events.ISlotRenderEndedEvent = {
                slot: {
                  getAdUnitPath(): string {
                    return slot.adUnitPath;
                  }
                } as googletag.IAdSlot
              } as googletag.events.ISlotRenderEndedEvent;
              // send the event
              listener(slotRenderEnded);
            });
          });
        }).then(() => {
          expect(triggerUserSyncsSpy).to.be.calledOnce;
        });
      });

    });

  });

  describe('ad slot registration', () => {

    const noopLoggerSpy = sandbox.spy(noopLogger, 'warn');

    describe('regular slots', () => {

      it('should filter slots if not present in the DOM', () => {
        const dfpService = newDfpService();

        getElementByIdStub.returns(null);

        const adSlot: Moli.AdSlot = {
          position: 'in-page',
          domId: 'not-available',
          behaviour: 'eager',
          adUnitPath: '/123/eager',
          sizes: [ 'fluid', [ 605, 165 ] ],
          sizeConfig: [
            {
              mediaQuery: '(min-width: 0px)',
              sizesSupported: [ [ 605, 165 ] ]
            }
          ]
        };

        return dfpService.initialize({
          slots: [ adSlot ], consent: consentConfig, logger: noopLogger
        }).then(config => {
          return dfpService.requestAds(config);
        }).then(() => {
          expect(googletagDefineSlotSpy.called).to.be.false;
        });
      });

      it('should register and refresh eagerly loaded in-page slot', () => {
        matchMediaStub.returns({ matches: true } as MediaQueryList);

        const dfpService = newDfpService();

        const adSlot: Moli.AdSlot = {
          position: 'in-page',
          domId: 'eager-loading-adslot',
          behaviour: 'eager',
          adUnitPath: '/123/eager',
          sizes: [ 'fluid', [ 605, 165 ] ],
          sizeConfig: [
            {
              mediaQuery: '(min-width: 0px)',
              sizesSupported: [ 'fluid', [ 605, 165 ] ]
            }
          ]
        };

        return dfpService.initialize({
          slots: [ adSlot ], consent: consentConfig, logger: noopLogger
        }).then(config => {
          return dfpService.requestAds(config);
        }).then(() => {
          expect(googletagDefineSlotSpy).to.have.been.calledOnce;
          expect(googletagDefineSlotSpy).to.have.been.calledOnceWithExactly(adSlot.adUnitPath, adSlot.sizes, adSlot.domId);
          expect(pubAdsServiceStubRefreshSpy).to.have.been.calledOnce;
        });
      });

      it('should register and refresh eagerly loaded out-of-page slot', () => {
        matchMediaStub.returns({ matches: true } as MediaQueryList);

        const dfpService = newDfpService();

        const adSlot: Moli.AdSlot = {
          position: 'out-of-page',
          domId: 'eager-loading-out-of-page-adslot',
          behaviour: 'eager',
          adUnitPath: '/123/eager',
          sizes: [],
          sizeConfig: [
            {
              mediaQuery: '(min-width: 0px)',
              sizesSupported: []
            }
          ]
        };

        return dfpService.initialize({
          slots: [ adSlot ], consent: consentConfig, logger: noopLogger
        }).then(config => {
          return dfpService.requestAds(config);
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
        matchMediaStub.returns({ matches: true } as MediaQueryList);

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
          prebid: prebidAdslotConfig,
          sizeConfig: [
            {
              mediaQuery: '(min-width: 0px)',
              sizesSupported: [ 'fluid', [ 605, 165 ] ]
            }
          ]
        };

        return dfpService.initialize({
          slots: [ adSlot ],
          logger: noopLogger,
          consent: consentConfig,
          prebid: { config: pbjsTestConfig }
        }).then(config => {
          return dfpService.requestAds(config);
        }).then(() => {
          expect(pbjsAddAdUnitSpy).to.have.been.calledOnce;
          expect(pbjsAddAdUnitSpy).to.have.been.calledOnceWithExactly([ prebidAdslotConfig.adUnit ]);

          expect(pbjsRequestBidsSpy).to.have.been.calledOnce;
          expect(pbjsRequestBidsSpy).to.have.been.calledOnceWithExactly(
            Sinon.match.has('adUnitCodes', Sinon.match.array.deepEquals([ 'eager-loading-adslot' ])).and(
              Sinon.match.has('bidsBackHandler', Sinon.match.defined).and(
                Sinon.match.has('labels', Sinon.match.array.deepEquals([]))
              )
            )
          );

          expect(pbjsSetTargetingForGPTAsyncSpy).to.have.been.calledOnce;
          expect(pbjsSetTargetingForGPTAsyncSpy).to.have.been.calledOnceWithExactly(
            Sinon.match.array.deepEquals([ 'eager-loading-adslot' ])
          );
        });
      });

      it('should filter prebidjs video playerSizes (single size)', () => {
        matchMediaStub.returns({ matches: true } as MediaQueryList);

        const dfpService = newDfpService();

        const prebidAdslotConfig: Moli.headerbidding.PrebidAdSlotConfig = {
          adUnit: {
            code: 'eager-loading-adslot',
            mediaTypes: {
              banner: undefined,
              video: {
                playerSize: [ 320, 180 ],
                context: 'outstream'
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
          sizes: [ 'fluid', [ 605, 165 ], [ 320, 180 ] ],
          sizeConfig: [
            {
              mediaQuery: '(min-width: 0px)',
              sizesSupported: [ 'fluid', [ 605, 165 ], [ 320, 180 ] ]
            }
          ],
          prebid: prebidAdslotConfig
        };

        return dfpService.initialize({
          labelSizeConfig: [
            {
              mediaQuery: '(min-width: 0px)',
              labelsSupported: []
            }
          ],
          slots: [ adSlot ],
          logger: noopLogger,
          consent: consentConfig,
          prebid: { config: pbjsTestConfig }
        }).then(config => {
          return dfpService.requestAds(config);
        }).then(() => {
          expect(pbjsAddAdUnitSpy).to.have.been.calledOnce;

          const adUnit: prebidjs.IAdUnit = {
            ...prebidAdslotConfig.adUnit,
            mediaTypes: {
              video: {
                context: 'outstream',
                playerSize: [ [ 320, 180 ] ] as [ number, number ][]
              }
            }
          };

          expect(pbjsAddAdUnitSpy).to.have.been.calledWithExactly([ adUnit ]);
        });
      });

      it('should filter prebidjs video playerSizes (multi size)', () => {
        matchMediaStub.returns({ matches: true } as MediaQueryList);

        const dfpService = newDfpService();

        const prebidAdslotConfig: Moli.headerbidding.PrebidAdSlotConfig = {
          adUnit: {
            code: 'eager-loading-adslot',
            mediaTypes: {
              banner: undefined,
              video: {
                playerSize: [ [ 316, 169 ], [ 320, 180 ], [ 640, 360 ] ] as [ number, number ][],
                context: 'outstream'
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
          sizes: [ 'fluid', [ 605, 165 ], [ 320, 180 ], [ 316, 169 ] ],
          prebid: prebidAdslotConfig,
          sizeConfig: [
            {
              mediaQuery: '(min-width: 0px)',
              sizesSupported: [ 'fluid', [ 605, 165 ], [ 320, 180 ], [ 316, 169 ] ]
            }
          ]
        };

        return dfpService.initialize({
          labelSizeConfig: [
            {
              mediaQuery: '(min-width: 0px)',
              labelsSupported: []
            }
          ],
          slots: [ adSlot ],
          logger: noopLogger,
          consent: consentConfig,
          prebid: { config: pbjsTestConfig }
        }).then(config => {
          return dfpService.requestAds(config);
        }).then(() => {
          expect(pbjsAddAdUnitSpy).to.have.been.calledOnce;
          expect(pbjsAddAdUnitSpy).to.have.been.calledWithExactly([ {
            code: 'eager-loading-adslot',
            mediaTypes: {
              video: {
                playerSize: [ [ 320, 180 ], [ 316, 169 ] ] as [ number, number ][],
                context: 'outstream'
              }
            },
            bids: [ {
              bidder: prebidjs.AppNexusAst,
              params: {
                placementId: '1234'
              }
            } ]
          } ]);
          expect(noopLoggerSpy).to.have.been.calledOnce;
        });
      });

      it('should filter prebidjs banner/video sizes using a slot-local sizeConfig', () => {
        matchMediaStub.returns({ matches: true } as MediaQueryList);

        const dfpService = newDfpService();

        const prebidAdslotConfig: Moli.headerbidding.PrebidAdSlotConfig = {
          adUnit: {
            code: 'eager-loading-adslot',
            mediaTypes: {
              banner: {
                sizes: [ [ 605, 165 ], [ 320, 150 ] ]
              },
              video: {
                playerSize: [ [ 320, 180 ], [ 640, 360 ], [ 1920, 1080 ] ] as [ number, number ][],
                context: 'outstream'
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
          prebid: prebidAdslotConfig,
          sizeConfig: [
            {
              mediaQuery: '(min-width: 320px)',
              sizesSupported: [ [ 320, 180 ], [ 640, 360 ], [ 605, 165 ] ]
            }
          ]
        };

        return dfpService.initialize({
          labelSizeConfig: [
            {
              mediaQuery: '(min-width: 0px)',
              labelsSupported: []
            }
          ],
          slots: [ adSlot ],
          logger: noopLogger,
          consent: consentConfig,
          prebid: { config: pbjsTestConfig }
        }).then(config => {
          return dfpService.requestAds(config);
        }).then(() => {
          expect(pbjsAddAdUnitSpy).to.have.been.calledOnce;
          expect(pbjsAddAdUnitSpy).to.have.been.calledWithExactly([ {
            code: 'eager-loading-adslot',
            mediaTypes: {
              banner: {
                sizes: [ [ 605, 165 ] ]
              },
              video: {
                playerSize: [ [ 320, 180 ], [ 640, 360 ] ] as [ number, number ][],
                context: 'outstream'
              }
            },
            bids: [ {
              bidder: prebidjs.AppNexusAst,
              params: {
                placementId: '1234'
              }
            } ]
          } ]);
        });
      });

      it('should add prebidjs adUnits with a dynamic configuration', () => {
        matchMediaStub.returns({ matches: true } as MediaQueryList);

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
          prebid: prebidAdSlotConfig,
          sizeConfig: [
            {
              mediaQuery: '(min-width: 0px)',
              sizesSupported: [ 'fluid', [ 605, 165 ] ]
            }
          ]
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
        }).then(config => {
          return dfpService.requestAds(config);
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

      it('should not add banner if the sizes are empty', () => {
        matchMediaStub.returns({ matches: true } as MediaQueryList);

        const dfpService = newDfpService();

        // define the prebidAdSlotConfig factory
        const prebidAdSlotConfig: Moli.headerbidding.PrebidAdSlotConfigProvider = {
          adUnit: {
            code: 'eager-loading-adslot',
            mediaTypes: { banner: { sizes: [ [ 123, 445 ] ] } },
            bids: [ {
              bidder: prebidjs.ImproveDigital, params: { placementId: 123, }
            } ]
          }
        };

        const adSlot: Moli.AdSlot = {
          position: 'in-page',
          domId: 'eager-loading-adslot',
          behaviour: 'eager',
          adUnitPath: '/123/eager',
          sizes: [ [ 300, 250 ] ],
          prebid: prebidAdSlotConfig,
          sizeConfig: [
            {
              mediaQuery: '(min-width: 0px)',
              sizesSupported: [ 'fluid', [ 300, 250 ] ]
            }
          ]
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
        }).then(config => {
          return dfpService.requestAds(config);
        }).then(() => {
          expect(pbjsAddAdUnitSpy).to.have.been.calledOnce;
          expect(pbjsAddAdUnitSpy).to.have.been.calledOnceWithExactly([ {
            code: 'eager-loading-adslot',
            mediaTypes: {},
            bids: [ {
              bidder: prebidjs.ImproveDigital,
              params: { placementId: 123, }
            } ]
          } ]);
        });
      });

      // ------------------
      // ----- A9 ---------
      // ------------------

      it('should fetchBids for a9 ad slots', () => {
        matchMediaStub.returns({ matches: true } as MediaQueryList);

        const dfpService = newDfpService();

        const adSlot: Moli.AdSlot = {
          position: 'in-page',
          domId: 'eager-loading-adslot',
          behaviour: 'eager',
          adUnitPath: '/123/eager',
          sizes: [ 'fluid', [ 605, 165 ] ],
          a9: {},
          sizeConfig: [
            {
              mediaQuery: '(min-width: 0px)',
              sizesSupported: [ 'fluid', [ 605, 165 ] ]
            }
          ]
        };

        return dfpService.initialize({
          slots: [ adSlot ],
          logger: noopLogger,
          consent: consentConfig,
          a9: a9ConfigStub
        }).then(config => {
          return dfpService.requestAds(config);
        }).then(() => {

          expect(apstagFetchBidsSpy).to.have.been.calledOnce;

          const fetchBidArgs = apstagFetchBidsSpy.firstCall.args;
          expect(fetchBidArgs).length(2);

          const bidConfig = fetchBidArgs[0] as apstag.IBidConfig;

          expect(bidConfig.slots).to.be.an('array');
          expect(bidConfig.slots).length(1);
          expect(bidConfig.slots[0].slotID).to.equal('eager-loading-adslot');
          expect(bidConfig.slots[0].slotName).to.equal('/123/eager');
          expect(bidConfig.slots[0].sizes).to.deep.equal([ [ 605, 165 ] ]);
          expect(bidConfig.bidTimeout).to.be.undefined;

          expect(fetchBidArgs[1]).to.be.a('function');

          expect(apstagSetDisplayBidsSpy).to.have.been.calledOnce;
        });
      });
    });

    describe('lazy slots', () => {

      it('should register and refresh lazy loaded slot based on event', () => {
        matchMediaStub.returns({ matches: true } as MediaQueryList);

        const dfpService = newDfpService();

        const adSlot: Moli.AdSlot = {
          position: 'in-page',
          domId: 'lazy-loading-adslot',
          behaviour: 'lazy',
          adUnitPath: '/123/lazy',
          sizes: [ [ 605, 340 ] ],
          sizeConfig: [
            {
              mediaQuery: '(min-width: 0px)',
              sizesSupported: [ [ 605, 340 ] ]
            }
          ],
          trigger: {
            name: 'event',
            event: 'slot-trigger',
            source: window
          }
        };

        return dfpService.initialize({
          slots: [ adSlot ], consent: consentConfig, logger: noopLogger
        }).then(config => {
          return dfpService.requestAds(config);
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
        matchMediaStub.returns({ matches: true } as MediaQueryList);

        const dfpService = newDfpService();

        const prebidAdslotConfig: Moli.headerbidding.PrebidAdSlotConfig = {
          adUnit: {
            code: 'lazy-loading-adslot',
            mediaTypes: {
              banner: {
                sizes: [ [ 605, 340 ] ]
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
          sizeConfig: [
            {
              mediaQuery: '(min-width: 0px)',
              sizesSupported: [ [ 605, 340 ] ]
            }
          ],
          trigger: {
            name: 'event',
            event: 'slot-trigger',
            source: window
          }
        };

        return dfpService.initialize({
          slots: [ adSlot ], prebid: { config: pbjsTestConfig }, consent: consentConfig, logger: noopLogger
        }).then(config => {
          return dfpService.requestAds(config);
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
        matchMediaStub.returns({ matches: true } as MediaQueryList);

        const dfpService = newDfpService();

        const adSlot: Moli.AdSlot = {
          position: 'in-page',
          domId: 'lazy-loading-adslot',
          behaviour: 'lazy',
          adUnitPath: '/123/lazy',
          sizes: [ [ 605, 340 ] ],
          sizeConfig: [
            {
              mediaQuery: '(min-width: 0px)',
              sizesSupported: [ [ 605, 340 ] ]
            }
          ],
          a9: {},
          trigger: {
            name: 'event',
            event: 'slot-trigger',
            source: window
          }
        };

        return dfpService.initialize({
          slots: [ adSlot ],
          logger: noopLogger,
          consent: consentConfig,
          a9: a9ConfigStub
        }).then(config => {
          return dfpService.requestAds(config);
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

          const bidConfig = fetchBidArgs[0] as apstag.IBidConfig;

          expect(bidConfig.slots).to.be.an('array');
          expect(bidConfig.slots).length(1);
          expect(bidConfig.slots[0].slotID).to.equal('lazy-loading-adslot');
          expect(bidConfig.slots[0].slotName).to.equal('/123/lazy');
          expect(bidConfig.slots[0].sizes).to.deep.equal([ [ 605, 340 ] ]);
          expect(bidConfig.bidTimeout).to.be.undefined;

          expect(fetchBidArgs[1]).to.be.a('function');

          expect(apstagSetDisplayBidsSpy).to.have.been.calledOnce;
        });
      });

    });

    describe('refreshable slots', () => {

      it('should register and refresh refreshable slot based on event without lazy loading', () => {
        matchMediaStub.returns({ matches: true } as MediaQueryList);

        const dfpService = newDfpService();

        const adSlot: Moli.AdSlot = {
          position: 'in-page',
          domId: 'refreshable-adslot',
          behaviour: 'refreshable',
          adUnitPath: '/123/refreshable',
          sizes: [ [ 605, 340 ] ],
          sizeConfig: [
            {
              mediaQuery: '(min-width: 0px)',
              sizesSupported: [ [ 605, 340 ] ]
            }
          ],
          trigger: {
            name: 'event',
            event: 'eager-slot-trigger',
            source: window
          }
        };

        return dfpService.initialize({
          slots: [ adSlot ], consent: consentConfig, logger: noopLogger
        }).then(config => {
          return dfpService.requestAds(config);
        }).then(() => {
          expect(googletagDefineSlotSpy).to.have.been.calledOnce;
          expect(googletagDefineSlotSpy).to.have.been.calledOnceWithExactly(adSlot.adUnitPath, adSlot.sizes, adSlot.domId);
          const adSlotArray = pubAdsServiceStubRefreshSpy.firstCall.lastArg;
          expect(adSlotArray).length(1);
        }).then(() => {
          window.dispatchEvent(new Event('eager-slot-trigger'));
          return sleep();
        }).then(() => {
          expect(googletagDefineSlotSpy).to.have.been.calledOnce;
          const adSlotArray = pubAdsServiceStubRefreshSpy.secondCall.lastArg;
          expect(adSlotArray).length(1);
        });
      });

      it('should register and refresh refreshable slot based on event lazily', () => {
        matchMediaStub.returns({ matches: true } as MediaQueryList);

        const dfpService = newDfpService();

        const adSlot: Moli.AdSlot = {
          position: 'in-page',
          domId: 'lazy-refreshable-adslot',
          behaviour: 'refreshable',
          adUnitPath: '/123/refreshable',
          sizes: [ [ 605, 340 ] ],
          sizeConfig: [
            {
              mediaQuery: '(min-width: 0px)',
              sizesSupported: [ [ 605, 340 ] ]
            }
          ],
          lazy: true,
          trigger: {
            name: 'event',
            event: 'lazy-slot-trigger',
            source: window
          }
        };

        return dfpService.initialize({
          slots: [ adSlot ], consent: consentConfig, logger: noopLogger
        }).then(config => {
          return dfpService.requestAds(config);
        }).then(() => {
          expect(googletagDefineSlotSpy).to.have.been.callCount(0);
          expect(pubAdsServiceStubRefreshSpy).to.have.been.calledOnce;
          expect(pubAdsServiceStubRefreshSpy).to.have.been.calledOnceWithExactly([]);
        }).then(() => {
          window.dispatchEvent(new Event('lazy-slot-trigger'));
          return sleep();
        }).then(() => {
          expect(googletagDefineSlotSpy).to.have.been.calledOnce;
          expect(googletagDefineSlotSpy).to.have.been.calledOnceWithExactly(adSlot.adUnitPath, adSlot.sizes, adSlot.domId);
          expect(pubAdsServiceStubRefreshSpy).to.have.calledTwice;
          const adSlotArray = pubAdsServiceStubRefreshSpy.secondCall.lastArg;
          expect(adSlotArray).length(1);
        });
      });

      it('should initPrebid for refreshable slot based on event', () => {
        matchMediaStub.returns({ matches: true } as MediaQueryList);

        const dfpService = newDfpService();

        const prebidAdslotConfig: Moli.headerbidding.PrebidAdSlotConfig = {
          adUnit: {
            code: 'refreshable-adslot',
            mediaTypes: {
              banner: {
                sizes: [ [ 605, 340 ] ]
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
          sizeConfig: [
            {
              mediaQuery: '(min-width: 0px)',
              sizesSupported: [ [ 605, 340 ] ]
            }
          ],
          prebid: prebidAdslotConfig,
          trigger: {
            name: 'event',
            event: 'slot-trigger',
            source: window
          }
        };

        return dfpService.initialize({
          slots: [ adSlot ], prebid: { config: pbjsTestConfig }, consent: consentConfig, logger: noopLogger
        }).then(config => {
          return dfpService.requestAds(config);
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
        matchMediaStub.returns({ matches: true } as MediaQueryList);

        const dfpService = newDfpService();

        const adSlot: Moli.AdSlot = {
          position: 'in-page',
          domId: 'refreshable-adslot',
          behaviour: 'refreshable',
          adUnitPath: '/123/refreshable',
          sizes: [ [ 605, 340 ] ],
          sizeConfig: [
            {
              mediaQuery: '(min-width: 0px)',
              sizesSupported: [ [ 605, 340 ] ]
            }
          ],
          a9: {},
          trigger: {
            name: 'event',
            event: 'slot-trigger',
            source: window
          }
        };

        return dfpService.initialize({
          slots: [ adSlot ],
          logger: noopLogger,
          consent: consentConfig,
          a9: a9ConfigStub
        }).then(config => {
          return dfpService.requestAds(config);
        }).then(() => {
          expect(apstagFetchBidsSpy).to.have.been.calledOnce;

          const fetchBidArgs = apstagFetchBidsSpy.firstCall.args;
          expect(fetchBidArgs).length(2);

          const bidConfig = fetchBidArgs[0] as apstag.IBidConfig;

          expect(bidConfig.slots).to.be.an('array');
          expect(bidConfig.slots).length(1);
          expect(bidConfig.slots[0].slotID).to.equal('refreshable-adslot');
          expect(bidConfig.slots[0].slotName).to.equal('/123/refreshable');
          expect(bidConfig.slots[0].sizes).to.deep.equal([ [ 605, 340 ] ]);
          expect(bidConfig.bidTimeout).to.be.undefined;

          expect(fetchBidArgs[1]).to.be.a('function');

          expect(apstagSetDisplayBidsSpy).to.have.been.calledOnce;

        }).then(() => {
          window.dispatchEvent(new Event('slot-trigger'));
          return sleep();
        }).then(() => {

          expect(apstagFetchBidsSpy).to.have.been.calledTwice;

          const fetchBidArgs = apstagFetchBidsSpy.secondCall.args;
          expect(fetchBidArgs).length(2);

          const bidConfig = fetchBidArgs[0] as apstag.IBidConfig;

          expect(bidConfig.slots).to.be.an('array');
          expect(bidConfig.slots).length(1);
          expect(bidConfig.slots[0].slotID).to.equal('refreshable-adslot');
          expect(bidConfig.slots[0].slotName).to.equal('/123/refreshable');
          expect(bidConfig.slots[0].sizes).to.deep.equal([ [ 605, 340 ] ]);
          expect(bidConfig.bidTimeout).to.be.undefined;

          expect(fetchBidArgs[1]).to.be.a('function');

          expect(apstagSetDisplayBidsSpy).to.have.been.calledTwice;
        });
      });

    });

    describe('sizeConfig', () => {

      it('should filter out slots from prebidjs adUnits that don\'t match the sizeConfig', () => {
        const dfpService = newDfpService();

        matchMediaStub.returns({ matches: true } as MediaQueryList);

        const prebidAdslotConfig: Moli.headerbidding.PrebidAdSlotConfig = {
          adUnit: {
            code: 'eager-loading-adslot',
            mediaTypes: {
              banner: {
                sizes: [ [ 605, 165 ], [ 500, 1000 ] ]
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
          sizeConfig: [
            {
              mediaQuery: '(min-width: 0px)',
              sizesSupported: [ [ 605, 165 ] ]
            }
          ],
          prebid: prebidAdslotConfig
        };

        const sizeConfigEntry1: Moli.LabelSizeConfigEntry = {
          mediaQuery: '(min-width: 300px)',
          labelsSupported: []
        };
        const sizeConfigEntry2: Moli.LabelSizeConfigEntry = {
          mediaQuery: '(min-width: 1000px)',
          labelsSupported: []
        };

        return dfpService.initialize({
          slots: [ adSlot ],
          logger: noopLogger,
          consent: consentConfig,
          labelSizeConfig: [ sizeConfigEntry1, sizeConfigEntry2 ],
          prebid: { config: pbjsTestConfig }
        }).then(config => {
          return dfpService.requestAds(config);
        }).then(() => {
          expect(pbjsAddAdUnitSpy).to.have.been.calledOnce;
          expect(pbjsAddAdUnitSpy).to.have.been.calledOnceWithExactly([
            {
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
          ]);
        });
      });

      it('should use the slot-local supported sizes', () => {
        const dfpService = newDfpService();

        const adSlot: Moli.AdSlot = {
          position: 'in-page',
          domId: 'eager-loading-adslot',
          behaviour: 'eager',
          adUnitPath: '/123/eager',
          sizes: [ 'fluid', [ 605, 165 ], [ 1000, 200 ] ],
          sizeConfig: [
            {
              sizesSupported: [ [ 150, 35 ], 'fluid' ],
              mediaQuery: 'min-width: 200px'
            },
            {
              sizesSupported: [ [ 1000, 200 ] ],
              mediaQuery: 'min-width: 500px'
            }
          ]
        };

        const sizeConfigEntry1: Moli.LabelSizeConfigEntry = {
          mediaQuery: 'min-width: 300px',
          labelsSupported: []
        };
        const sizeConfigEntry2: Moli.LabelSizeConfigEntry = {
          mediaQuery: 'min-width: 1000px',
          labelsSupported: []
        };

        // first two calls are the global config
        matchMediaStub.onCall(0).returns({ matches: true } as MediaQueryList);
        matchMediaStub.onCall(1).returns({ matches: false } as MediaQueryList);

        // second call is the specific one
        matchMediaStub.onCall(2).returns({ matches: true } as MediaQueryList);
        matchMediaStub.onCall(3).returns({ matches: true } as MediaQueryList);

        return dfpService.initialize({
          slots: [ adSlot ],
          labelSizeConfig: [ sizeConfigEntry1, sizeConfigEntry2 ],
          consent: consentConfig,
          logger: noopLogger
        }).then(config => {
          return dfpService.requestAds(config);
        }).then(() => {
          expect(googletagDefineSlotSpy).to.have.been.calledOnce;
          expect(googletagDefineSlotSpy).to.have.been.calledOnceWithExactly(adSlot.adUnitPath, [ 'fluid', [ 1000, 200 ] ], adSlot.domId);
          expect(pubAdsServiceStubRefreshSpy).to.have.been.calledOnce;
        });
      });

      it('should add requestBids with the supported labels', () => {
        matchMediaStub.returns({ matches: true } as MediaQueryList);

        const dfpService = newDfpService();

        const sizeConfigEntry: Moli.LabelSizeConfigEntry = {
          mediaQuery: 'min-width: 300px',
          labelsSupported: [ 'foo', 'bar' ]
        };

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
          sizeConfig: [
            {
              mediaQuery: '(min-width: 0px)',
              sizesSupported: [ [ 605, 165 ] ]
            }
          ],
          prebid: prebidAdslotConfig
        };

        return dfpService.initialize({
          slots: [ adSlot ],
          logger: noopLogger,
          consent: consentConfig,
          labelSizeConfig: [ sizeConfigEntry ],
          prebid: { config: pbjsTestConfig }
        }).then(config => {
          return dfpService.requestAds(config);
        }).then(() => {
          expect(pbjsAddAdUnitSpy).to.have.been.calledOnce;
          expect(pbjsAddAdUnitSpy).to.have.been.calledOnceWithExactly([ prebidAdslotConfig.adUnit ]);

          expect(pbjsRequestBidsSpy).to.have.been.calledOnce;
          expect(pbjsRequestBidsSpy).to.have.been.calledOnceWithExactly(
            Sinon.match.has('adUnitCodes', Sinon.match.array.deepEquals([ 'eager-loading-adslot' ])).and(
              Sinon.match.has('bidsBackHandler', Sinon.match.defined)
            ).and(Sinon.match.has('labels', Sinon.match.array.deepEquals([ 'foo', 'bar' ])))
          );

          expect(pbjsSetTargetingForGPTAsyncSpy).to.have.been.calledOnce;
          expect(pbjsSetTargetingForGPTAsyncSpy).to.have.been.calledOnceWithExactly(
            Sinon.match.array.deepEquals([ 'eager-loading-adslot' ])
          );
        });
      });

      it('should filter requestBids with the supported labels', () => {
        matchMediaStub.returns({ matches: true } as MediaQueryList);

        const dfpService = newDfpService();

        const sizeConfigEntry: Moli.LabelSizeConfigEntry = {
          mediaQuery: 'min-width: 300px',
          labelsSupported: [ 'foo', 'bar' ]
        };

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
                placementId: '1'
              }
            }, {
              bidder: prebidjs.AppNexusAst,
              labelAll: [ 'foo', 'bar' ],
              params: {
                placementId: '2'
              }
            }, {
              bidder: prebidjs.AppNexusAst,
              labelAny: [ 'foo' ],
              params: {
                placementId: '3'
              }
            }, {
              bidder: prebidjs.AppNexusAst,
              labelAll: [ 'foo', 'baz' ],
              params: {
                placementId: '4'
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
          sizeConfig: [
            {
              mediaQuery: '(min-width: 0px)',
              sizesSupported: [ [ 605, 165 ] ]
            }
          ],
          prebid: prebidAdslotConfig
        };

        return dfpService.initialize({
          slots: [ adSlot ],
          logger: noopLogger,
          consent: consentConfig,
          labelSizeConfig: [ sizeConfigEntry ],
          prebid: { config: pbjsTestConfig }
        }).then(config => {
          return dfpService.requestAds(config);
        }).then(() => {
          expect(pbjsAddAdUnitSpy).to.have.been.calledOnce;

          const adUnits = pbjsAddAdUnitSpy.firstCall.args[0] as prebidjs.IAdUnit[];

          expect(adUnits).length(1);
          expect(adUnits[0].bids).length(3);
          expect(adUnits[0].bids).to.deep.equal([ {
            bidder: prebidjs.AppNexusAst,
            params: {
              placementId: '1'
            }
          }, {
            bidder: prebidjs.AppNexusAst,
            labelAll: [ 'foo', 'bar' ],
            params: {
              placementId: '2'
            }
          }, {
            bidder: prebidjs.AppNexusAst,
            labelAny: [ 'foo' ],
            params: {
              placementId: '3'
            }
          } ]);


          expect(pbjsRequestBidsSpy).to.have.been.calledOnce;
          expect(pbjsRequestBidsSpy).to.have.been.calledOnceWithExactly(
            Sinon.match.has('adUnitCodes', Sinon.match.array.deepEquals([ 'eager-loading-adslot' ])).and(
              Sinon.match.has('bidsBackHandler', Sinon.match.defined)
            ).and(Sinon.match.has('labels', Sinon.match.array.deepEquals([ 'foo', 'bar' ])))
          );

          expect(pbjsSetTargetingForGPTAsyncSpy).to.have.been.calledOnce;
          expect(pbjsSetTargetingForGPTAsyncSpy).to.have.been.calledOnceWithExactly(
            Sinon.match.array.deepEquals([ 'eager-loading-adslot' ])
          );
        });
      });

      it('should filter mediaTypes.banner when sizes is empty', () => {
        matchMediaStub.returns({ matches: true } as MediaQueryList);

        const dfpService = newDfpService();

        const sizeConfigEntry: Moli.LabelSizeConfigEntry = {
          mediaQuery: 'min-width: 300px',
          labelsSupported: [ 'foo', 'bar' ]
        };

        const prebidAdslotConfig: Moli.headerbidding.PrebidAdSlotConfig = {
          adUnit: {
            code: 'eager-loading-adslot',
            mediaTypes: {
              banner: {
                sizes: [ [ 605, 165 ] ]
              },
              video: {
                context: 'outstream',
                playerSize: [ 605, 340 ]
              }
            },
            bids: [ {
              bidder: prebidjs.AppNexusAst,
              params: {
                placementId: '1'
              }
            } ]
          }
        };

        const adSlot: Moli.AdSlot = {
          position: 'in-page',
          domId: 'eager-loading-adslot',
          behaviour: 'eager',
          adUnitPath: '/123/eager',
          sizes: [ 'fluid', [ 605, 165 ], [ 605, 340 ] ],
          sizeConfig: [
            {
              mediaQuery: '(min-width: 0px)',
              sizesSupported: [ [ 605, 340 ] ]
            }
          ],
          prebid: prebidAdslotConfig
        };

        return dfpService.initialize({
          slots: [ adSlot ],
          logger: noopLogger,
          consent: consentConfig,
          labelSizeConfig: [ sizeConfigEntry ],
          prebid: { config: pbjsTestConfig }
        }).then(config => {
          return dfpService.requestAds(config);
        }).then(() => {
          expect(pbjsAddAdUnitSpy).to.have.been.calledOnce;

          const adUnits = pbjsAddAdUnitSpy.firstCall.args[0] as prebidjs.IAdUnit[];

          expect(adUnits).length(1);
          expect(adUnits[0].mediaTypes.video).to.be.ok;
          expect(adUnits[0].mediaTypes.banner).to.be.undefined;

        });
      });

      it('should filter mediaTypes.video when playerSize is empty', () => {
        matchMediaStub.returns({ matches: true } as MediaQueryList);

        const dfpService = newDfpService();

        const sizeConfigEntry: Moli.LabelSizeConfigEntry = {
          mediaQuery: 'min-width: 300px',
          labelsSupported: [ 'foo', 'bar' ]
        };

        const prebidAdslotConfig: Moli.headerbidding.PrebidAdSlotConfig = {
          adUnit: {
            code: 'eager-loading-adslot',
            mediaTypes: {
              banner: {
                sizes: [ [ 605, 165 ] ]
              },
              video: {
                context: 'outstream',
                playerSize: [ 605, 340 ]
              }
            },
            bids: [ {
              bidder: prebidjs.AppNexusAst,
              params: {
                placementId: '1'
              }
            } ]
          }
        };

        const adSlot: Moli.AdSlot = {
          position: 'in-page',
          domId: 'eager-loading-adslot',
          behaviour: 'eager',
          adUnitPath: '/123/eager',
          sizes: [ 'fluid', [ 605, 165 ], [ 605, 340 ] ],
          sizeConfig: [
            {
              mediaQuery: '(min-width: 0px)',
              sizesSupported: [ [ 605, 165 ] ]
            }
          ],
          prebid: prebidAdslotConfig
        };

        return dfpService.initialize({
          slots: [ adSlot ],
          logger: noopLogger,
          consent: consentConfig,
          labelSizeConfig: [ sizeConfigEntry ],
          prebid: { config: pbjsTestConfig }
        }).then(config => {
          return dfpService.requestAds(config);
        }).then(() => {
          expect(pbjsAddAdUnitSpy).to.have.been.calledOnce;

          const adUnits = pbjsAddAdUnitSpy.firstCall.args[0] as prebidjs.IAdUnit[];

          expect(adUnits).length(1);
          expect(adUnits[0].mediaTypes.banner).to.be.ok;
          expect(adUnits[0].mediaTypes.video).to.be.undefined;

        });
      });

      it('should filter a9 fetchBids with the supported labels', () => {
        matchMediaStub.returns({ matches: true } as MediaQueryList);

        const dfpService = newDfpService();

        const sizeConfigEntry: Moli.LabelSizeConfigEntry = {
          mediaQuery: 'min-width: 300px',
          labelsSupported: [ 'foo', 'bar' ]
        };

        const adSlotNoLabels: Moli.AdSlot = {
          position: 'in-page',
          domId: 'no-labels',
          behaviour: 'eager',
          adUnitPath: '/123/no-labels',
          sizes: [ 'fluid', [ 605, 165 ] ],
          sizeConfig: [
            {
              mediaQuery: '(min-width: 0px)',
              sizesSupported: [ [ 605, 165 ] ]
            }
          ],
          a9: {}
        };

        const adSlotMatchingLabels: Moli.AdSlot = {
          position: 'in-page',
          domId: 'matching-labels',
          behaviour: 'eager',
          adUnitPath: '/123/matching-labels',
          sizes: [ 'fluid', [ 605, 165 ] ],
          sizeConfig: [
            {
              mediaQuery: '(min-width: 0px)',
              sizesSupported: [ [ 605, 165 ] ]
            }
          ],
          a9: {
            labelAll: [ 'foo' ]
          }
        };

        const adSlotNoMatchingLabels: Moli.AdSlot = {
          position: 'in-page',
          domId: 'no-matching-labels',
          behaviour: 'eager',
          adUnitPath: '/123/no-matching-labels',
          sizes: [ 'fluid', [ 605, 165 ] ],
          sizeConfig: [
            {
              mediaQuery: '(min-width: 0px)',
              sizesSupported: [ [ 605, 165 ] ]
            }
          ],
          a9: {
            labelAll: [ 'invalid' ]
          }
        };

        return dfpService.initialize({
          slots: [ adSlotNoLabels, adSlotMatchingLabels, adSlotNoMatchingLabels ],
          logger: noopLogger,
          consent: consentConfig,
          labelSizeConfig: [ sizeConfigEntry ],
          a9: a9ConfigStub
        }).then(config => {
          return dfpService.requestAds(config);
        }).then(() => {
          expect(apstagFetchBidsSpy).to.have.been.calledOnce;

          const fetchBidArgs = apstagFetchBidsSpy.firstCall.args;
          expect(fetchBidArgs).length(2);

          const bidConfig = fetchBidArgs[0] as apstag.IBidConfig;

          expect(bidConfig.slots).to.be.an('array');
          expect(bidConfig.slots).length(2);
          expect(bidConfig.slots[0].slotID).to.equal('no-labels');
          expect(bidConfig.slots[0].slotName).to.equal('/123/no-labels');
          expect(bidConfig.slots[0].sizes).to.deep.equal([ [ 605, 165 ] ]);

          expect(bidConfig.slots[1].slotID).to.equal('matching-labels');
          expect(bidConfig.slots[1].slotName).to.equal('/123/matching-labels');
          expect(bidConfig.slots[1].sizes).to.deep.equal([ [ 605, 165 ] ]);
        });
      });

      it('should filter a9 fetchBids with the supported sizes', () => {
        matchMediaStub.returns({ matches: true } as MediaQueryList);

        const dfpService = newDfpService();

        const sizeConfigEntry: Moli.LabelSizeConfigEntry = {
          mediaQuery: 'min-width: 300px',
          labelsSupported: [ 'foo', 'bar' ]
        };

        const adSlotMatchingSizes: Moli.AdSlot = {
          position: 'in-page',
          domId: 'no-labels',
          behaviour: 'eager',
          adUnitPath: '/123/no-labels',
          sizes: [ [ 605, 165 ] ],
          sizeConfig: [
            {
              mediaQuery: '(min-width: 0px)',
              sizesSupported: [ [ 605, 165 ] ]
            }
          ],
          a9: {}
        };

        const adSlotFilteredSizes: Moli.AdSlot = {
          position: 'in-page',
          domId: 'matching-labels',
          behaviour: 'eager',
          adUnitPath: '/123/matching-labels',
          sizes: [ 'fluid', [ 300, 250 ], [ 605, 165 ] ],
          sizeConfig: [
            {
              mediaQuery: '(min-width: 0px)',
              sizesSupported: [ [ 605, 165 ] ]
            }
          ],
          a9: {}
        };

        const adSlotNoSupportedSizes: Moli.AdSlot = {
          position: 'in-page',
          domId: 'no-matching-labels',
          behaviour: 'eager',
          adUnitPath: '/123/no-matching-labels',
          sizes: [ 'fluid', [ 605, 340 ] ],
          sizeConfig: [
            {
              mediaQuery: '(min-width: 0px)',
              sizesSupported: [ [ 605, 165 ] ]
            }
          ],
          a9: {}
        };

        return dfpService.initialize({
          slots: [ adSlotMatchingSizes, adSlotFilteredSizes, adSlotNoSupportedSizes ],
          logger: noopLogger,
          consent: consentConfig,
          labelSizeConfig: [ sizeConfigEntry ],
          a9: a9ConfigStub
        }).then(config => {
          return dfpService.requestAds(config);
        }).then(() => {
          expect(apstagFetchBidsSpy).to.have.been.calledOnce;

          const fetchBidArgs = apstagFetchBidsSpy.firstCall.args;
          expect(fetchBidArgs).length(2);

          const bidConfig = fetchBidArgs[0] as apstag.IBidConfig;

          expect(bidConfig.slots).to.be.an('array');
          expect(bidConfig.slots).length(2);
          expect(bidConfig.slots[0].slotID).to.equal('no-labels');
          expect(bidConfig.slots[0].slotName).to.equal('/123/no-labels');
          expect(bidConfig.slots[0].sizes).to.deep.equal([ [ 605, 165 ] ]);

          expect(bidConfig.slots[1].slotID).to.equal('matching-labels');
          expect(bidConfig.slots[1].slotName).to.equal('/123/matching-labels');
          expect(bidConfig.slots[1].sizes).to.deep.equal([ [ 605, 165 ] ]);
        });
      });


    });
  });

  describe('destroy ad slots', () => {

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
      sizeConfig: [
        {
          mediaQuery: '(min-width: 0px)',
          sizesSupported: [ 'fluid', [ 605, 165 ] ]
        }
      ]
    };


    it('should destroy all gpt ad slots', () => {
      matchMediaStub.returns({ matches: true } as MediaQueryList);

      const dfpService = newDfpService();

      const destroySlotsSpy = sandbox.spy(window.googletag, 'destroySlots');


      const config = {
        slots: [ adSlot ],
        logger: noopLogger,
        consent: consentConfig
      };

      return dfpService.initialize(config)
        .then(() => dfpService.requestAds(config))
        .then(() => dfpService.destroyAdSlots(config))
        .then(() => {
          expect(destroySlotsSpy).to.have.been.calledOnce;
          expect(destroySlotsSpy).to.have.been.calledOnceWithExactly();

        });
    });


    it('should remove all prebid adUnits', () => {
      const dfpService = newDfpService();

      const removeAdUnitSpy = sandbox.spy(window.pbjs, 'removeAdUnit');


      const config = {
        slots: [],
        logger: noopLogger,
        consent: consentConfig
      };

      // initialize the internal adUnits data structure of prebid
      (window.pbjs as any).adUnits = [
        { code: 'ad-1' },
        { code: 'ad-2' }
      ];

      return dfpService.initialize(config)
        .then(() => dfpService.requestAds(config))
        .then(() => dfpService.destroyAdSlots(config))
        .then(() => {
          expect(removeAdUnitSpy).to.have.been.calledTwice;
          expect(removeAdUnitSpy.firstCall).calledWithExactly('ad-1');
          expect(removeAdUnitSpy.secondCall).calledWithExactly('ad-2');
        });
    });

  });

  describe('setting key/value pairs', () => {

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
        labelSizeConfig: []
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

  describe('test environment', () => {

    it('should not call the googletag pubads() service', () => {
      matchMediaStub.returns({ matches: true } as MediaQueryList);

      const dfpService = newDfpService();

      const adSlots: Moli.AdSlot[] = [ {
        position: 'in-page',
        domId: 'no-labels',
        behaviour: 'eager',
        adUnitPath: '/123/no-labels',
        sizes: [ [ 605, 165 ] ],
        sizeConfig: [
          {
            mediaQuery: '(min-width: 0px)',
            sizesSupported: [ [ 605, 165 ] ]
          }
        ]
      }, {
        position: 'out-of-page',
        domId: 'eager-loading-out-of-page-adslot',
        behaviour: 'eager',
        adUnitPath: '/123/eager',
        sizes: [],
        sizeConfig: [
          {
            mediaQuery: '(min-width: 0px)',
            sizesSupported: []
          }
        ]
      } ];


      return dfpService.initialize({
        environment: 'test', slots: adSlots, consent: consentConfig, logger: noopLogger
      }).then(config => {
        return dfpService.requestAds(config);
      }).then(() => {
        expect(googleTagPubAdsSpy).to.have.not.been.called;
        expect(pubAdsServiceStubRefreshSpy).to.have.not.been.called;
      });
    });

    it('should not initialize prebid', () => {
      matchMediaStub.returns({ matches: true } as MediaQueryList);

      const dfpService = newDfpService();

      const prebidAdslotConfig: Moli.headerbidding.PrebidAdSlotConfig = {
        adUnit: {
          code: 'eager-loading-adslot',
          mediaTypes: {
            banner: {
              sizes: [ [ 605, 165 ] ]
            },
            video: undefined
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
        sizeConfig: [
          {
            mediaQuery: '(min-width: 0px)',
            sizesSupported: [ [ 605, 165 ] ]
          }
        ],
        prebid: prebidAdslotConfig
      };


      return dfpService.initialize({
        environment: 'test',
        slots: [ adSlot ],
        consent: consentConfig,
        logger: noopLogger,
        prebid: { config: pbjsTestConfig }
      }).then(config => {
        return dfpService.requestAds(config);
      }).then(() => {
        expect(googletagDefineSlotSpy).to.have.been.calledOnce;
        expect(pbjsAddAdUnitSpy).to.have.not.been.called;
        expect(pbjsRequestBidsSpy).to.have.not.been.called;
        expect(pbjsSetTargetingForGPTAsyncSpy).to.have.not.been.called;
      });
    });
  });

  it('should not initialize a9', () => {
    matchMediaStub.returns({ matches: true } as MediaQueryList);

    const dfpService = newDfpService();

    const adSlot: Moli.AdSlot = {
      position: 'in-page',
      domId: 'eager-loading-adslot',
      behaviour: 'eager',
      adUnitPath: '/123/eager',
      sizes: [ 'fluid', [ 605, 165 ] ],
      sizeConfig: [
        {
          mediaQuery: '(min-width: 0px)',
          sizesSupported: [ [ 605, 165 ] ]
        }
      ],
      a9: {}
    };


    return dfpService.initialize({
      environment: 'test',
      slots: [ adSlot ],
      consent: consentConfig,
      logger: noopLogger,
      prebid: { config: pbjsTestConfig }
    }).then(config => {
      return dfpService.requestAds(config);
    }).then(() => {
      expect(googletagDefineSlotSpy).to.have.been.calledOnce;
      expect(apstagFetchBidsSpy).to.have.not.been.called;
      expect(apstagFetchBidsSpy).to.have.not.been.called;
    });
  });

});

// tslint:enable
