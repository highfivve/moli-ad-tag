import '../stubs/browserEnvSetup';
import { expect, use } from 'chai';
import * as sinonChai from 'sinon-chai';
import * as Sinon from 'sinon';
import { prebidjs } from '../../../source/ts/types/prebidjs';
import { apstag } from '../../../source/ts/types/apstag';
import { DfpService, moli } from '../../../source/ts/ads/dfpService';
import { Moli } from '../../../source/ts/types/moli';
import { assetLoaderService, AssetLoadMethod, AssetType } from '../../../source/ts/util/assetLoaderService';
import { cookieService } from '../../../source/ts/util/cookieService';
import { googletagStub, pubAdsServiceStub } from '../stubs/googletagStubs';
import { pbjsStub, pbjsTestConfig } from '../stubs/prebidjsStubs';
import { apstagStub, a9ConfigStub } from '../stubs/a9Stubs';
import { noopLogger } from '../stubs/moliStubs';

// setup sinon-chai
use(sinonChai);

// tslint:disable: no-unused-expression
describe('moli', () => {

  it('should have been exported', () => {
    expect(moli).to.be.ok;
  });

});

describe('DfpService', () => {
  const sandbox = Sinon.createSandbox();
  const assetLoaderFetch = sandbox.stub(assetLoaderService, 'loadAsset');
  const newDfpService = (): DfpService => {
    return new DfpService(assetLoaderService, cookieService);
  };

  beforeEach(() => {
    window.googletag = googletagStub;
    window.pbjs = pbjsStub;
    window.apstag = apstagStub;
    assetLoaderFetch.resolves();
  });

  afterEach(() => {
    sandbox.reset();
  });

  describe('window initialization code', () => {

    const sleep = () => new Promise(resolve => {
      setTimeout(resolve, 100);
    });

    it('should configure window.pbjs.que', () => {
      (window as any).pbjs = undefined;
      const init = newDfpService().initialize({ slots: [], logger: noopLogger, prebid: { config: pbjsTestConfig } });

      return sleep()
        .then(() => {
          expect(window.pbjs.que).to.be.ok;
          // resolve queue and set stub
          (window as any).pbjs.que[0]();
          window.pbjs = pbjsStub;
        })
        .then(() => init);
    });

    it('should not configure window.pbjs.que without prebid config', () => {
      (window as any).pbjs = undefined;
      const init = newDfpService().initialize({ slots: [], logger: noopLogger });

      return sleep()
        .then(() => {
          expect(window.pbjs).to.be.undefined;
        })
        .then(() => init);

    });

    it('should configure window.apstag', () => {
      (window as any).apstag = undefined;
      const init = newDfpService().initialize({ slots: [], logger: noopLogger, a9: a9ConfigStub });
      return sleep()
        .then(() => {
          expect(window.apstag._Q).to.be.ok;
          expect(window.apstag.init).to.be.ok;
          expect(window.apstag.fetchBids).to.be.ok;

          expect(assetLoaderFetch).to.be.calledOnceWithExactly({
            name: 'A9',
            assetType: AssetType.SCRIPT,
            loadMethod: AssetLoadMethod.TAG,
            assetUrl: '//c.amazon-adsystem.com/aax2/apstag.js'
          });
        })
        .then(() => init);
    });

    it('should not configure window.apstag if no a9 is requested', () => {
      (window as any).apstag = undefined;
      const init = newDfpService().initialize({ slots: [], logger: noopLogger });
      return sleep()
        .then(() => {
          expect(window.apstag).to.be.undefined;
          expect(assetLoaderFetch).not.called;
        })
        .then(() => init);
    });

    it('should configure window.googletag.cmd', () => {
      (window as any).googletag = undefined;
      const init = newDfpService().initialize({ slots: [], logger: noopLogger });
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
            assetType: AssetType.SCRIPT,
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
          prebid: {
            config: pbjsTestConfig,
            bidderSettings: bidderSettings
          }
        }
      )
        .then(() => {
          expect(window.pbjs.bidderSettings).not.to.be.undefined;
          expect(window.pbjs.bidderSettings).to.be.equals(bidderSettings);
        });
    });


  });


  describe('ad slot registration', () => {

    window.googletag = googletagStub;
    window.pbjs = pbjsStub;

    const getElementByIdStub = sandbox.stub(document, 'getElementById');
    const googletagDefineSlotStub = sandbox.stub(window.googletag, 'defineSlot');
    const googletagDefineOutOfPageSlotStub = sandbox.stub(window.googletag, 'defineOutOfPageSlot');
    const pubAdsServiceStubRefreshStub = sandbox.stub(pubAdsServiceStub, 'refresh');

    beforeEach(() => {
      getElementByIdStub.returns({});
      googletagDefineSlotStub.callThrough();
      pubAdsServiceStubRefreshStub.callThrough();
      googletagDefineOutOfPageSlotStub.callThrough();
    });

    describe('regular slots', () => {

      it('should filter slots if not present in the DOM', () => {
        const dfpService = newDfpService();

        getElementByIdStub.returns(null);

        const adSlot: Moli.AdSlot = {
          position: 'in-page',
          domId: 'not-available',
          behaviour: 'eager',
          adUnitPath: '/123/eager',
          sizes: ['fluid', [605, 165]]
        };

        return dfpService.initialize({
          slots: [adSlot], logger: noopLogger
        }).then(() => {
          expect(googletagDefineSlotStub.called).to.be.false;
        });
      });

      it('should register and refresh eagerly loaded in-page slot', () => {
        const dfpService = newDfpService();

        getElementByIdStub.returns({});

        const adSlot: Moli.AdSlot = {
          position: 'in-page',
          domId: 'eager-loading-adslot',
          behaviour: 'eager',
          adUnitPath: '/123/eager',
          sizes: ['fluid', [605, 165]]
        };

        return dfpService.initialize({
          slots: [adSlot], logger: noopLogger
        }).then(() => {
          expect(googletagDefineSlotStub).to.have.been.calledOnce;
          expect(googletagDefineSlotStub).to.have.been.calledOnceWithExactly(adSlot.adUnitPath, adSlot.sizes, adSlot.domId);
          expect(pubAdsServiceStubRefreshStub).to.have.been.calledOnce;
        });
      });

      it('should register and refresh eagerly loaded out-of-page slot', () => {
        const dfpService = newDfpService();

        getElementByIdStub.returns({});

        const adSlot: Moli.AdSlot = {
          position: 'out-of-page',
          domId: 'eager-loading-out-of-page-adslot',
          behaviour: 'eager',
          adUnitPath: '/123/eager',
          sizes: []
        };

        return dfpService.initialize({
          slots: [adSlot], logger: noopLogger
        }).then(() => {
          expect(googletagDefineOutOfPageSlotStub).to.have.been.calledOnce;
          expect(googletagDefineOutOfPageSlotStub).to.have.been.calledOnceWithExactly(adSlot.adUnitPath, adSlot.domId);
          expect(pubAdsServiceStubRefreshStub).to.have.been.calledOnce;
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
                sizes: [[605, 165]]
              }
            },
            bids: [{
              bidder: prebidjs.AppNexusAst,
              params: {
                placementId: '1234'
              }
            }]
          }
        };

        const adSlot: Moli.AdSlot = {
          position: 'in-page',
          domId: 'eager-loading-adslot',
          behaviour: 'eager',
          adUnitPath: '/123/eager',
          sizes: ['fluid', [605, 165]],
          prebid: prebidAdslotConfig
        };

        const pbjsAddAdUnitSpy = sandbox.spy(window.pbjs, 'addAdUnits');
        const pbjsRequestBidsSpy = sandbox.spy(window.pbjs, 'requestBids');
        const pbjsSetTargetingForGPTAsyncSpy = sandbox.spy(window.pbjs, 'setTargetingForGPTAsync');

        return dfpService.initialize({
          slots: [adSlot],
          logger: noopLogger,
          prebid: { config: pbjsTestConfig }
        }).then(() => {
          expect(pbjsAddAdUnitSpy).to.have.been.calledOnce;
          expect(pbjsAddAdUnitSpy).to.have.been.calledOnceWithExactly([prebidAdslotConfig.adUnit]);

          expect(pbjsRequestBidsSpy).to.have.been.calledOnce;
          expect(pbjsRequestBidsSpy).to.have.been.calledOnceWithExactly(
            Sinon.match.has('adUnitCodes', Sinon.match.array.deepEquals(['eager-loading-adslot'])).and(
              Sinon.match.has('bidsBackHandler', Sinon.match.defined)
            )
          );

          expect(pbjsSetTargetingForGPTAsyncSpy).to.have.been.calledOnce;
          expect(pbjsSetTargetingForGPTAsyncSpy).to.have.been.calledOnceWithExactly(
            Sinon.match.array.deepEquals(['eager-loading-adslot'])
          );
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
          sizes: ['fluid', [605, 165]],
          a9: {}
        };

        const pbjsFetchBidsSpy = sandbox.spy(window.apstag, 'fetchBids');
        const pbjsSetDisplayBidsSpy = sandbox.spy(window.apstag, 'setDisplayBids');

        return dfpService.initialize({
          slots: [adSlot],
          logger: noopLogger,
          a9: a9ConfigStub
        }).then(() => {

          expect(pbjsFetchBidsSpy).to.have.been.calledOnce;

          const fetchBidArgs = pbjsFetchBidsSpy.firstCall.args;
          expect(fetchBidArgs).length(2);

          const bidConfig = fetchBidArgs[ 0 ] as apstag.IBidConfig;

          expect(bidConfig.slots).to.be.an('array');
          expect(bidConfig.slots).length(1);
          expect(bidConfig.slots[0].slotID).to.be.equal('eager-loading-adslot');
          expect(bidConfig.slots[0].slotName).to.be.equal('/123/eager');
          expect(bidConfig.slots[0].sizes).to.be.deep.equal([[605, 165]]);
          expect(bidConfig.timeout).to.be.equal(666);

          expect(fetchBidArgs[ 1 ]).to.be.a('function');

          expect(pbjsSetDisplayBidsSpy).to.have.been.calledOnce;
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
      const setTargetingStub = sandbox.stub(window.googletag.pubads(), 'setTargeting');

      const adConfiguration: Moli.MoliConfig = {
        slots: [],
        logger: noopLogger,
        targeting: {
          keyValues: [
            { key: 'gfversion', value: ['v2016'] },
            { key: 'sprechstunde', value: 'true' }
          ]
        },
        sizeConfig: []
      };

      return moli.initialize(adConfiguration)
        .then(() => {
          expect(setTargetingStub).to.be.calledTwice;
          expect(setTargetingStub).to.be.calledWith('gfversion', Sinon.match.array.deepEquals(['v2016']));
          expect(setTargetingStub).to.be.calledWith('sprechstunde', 'true');
        });
    });
  });
});

// tslint:enable
