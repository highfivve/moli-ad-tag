import browserEnv = require('browser-env');

browserEnv([ 'window', 'document' ]);

import { expect, use } from 'chai';
import * as sinonChai from 'sinon-chai';
import * as Sinon from 'sinon';
import { prebidjs } from '../../../source/ts';
import { DfpService, moli } from '../../../source/ts/ads/dfpService';
import { Moli } from '../../../source/ts/types/moli';
import { assetLoaderService } from '../../../source/ts/util/assetLoaderService';
import { cookieService } from '../../../source/ts/util/cookieService';
import { googletagStub } from '../stubs/googletagStubs';
import { pbjsStub, pbjsTestConfig } from '../stubs/prebidjsStubs';

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
  const newDfpService = (): DfpService => {
    return new DfpService(assetLoaderService, cookieService);
  };

  afterEach(() => {
    sandbox.reset();
  });

  describe('window initialization code', () => {

    it.skip('should configure window.googletag.cmd', () => {
      expect(window.googletag.cmd).to.be.ok;
    });

    it.skip('should configure window.pbjs.que', () => {
      expect(window.pbjs.que).to.be.ok;
    });

    it.skip('should configure window.pbjs._Q', () => {
      expect(window.apstag._Q).to.be.ok;
      expect(window.apstag.init).to.be.ok;
      expect(window.apstag.fetchBids).to.be.ok;
    });
  });

  describe('ad slot registration', () => {

    window.googletag = googletagStub;
    window.pbjs = pbjsStub;

    const getElementByIdStub = sandbox.stub(document, 'getElementById');
    const googletagDefineSlotStub = sandbox.stub(window.googletag, 'defineSlot');

    beforeEach(() => {
      getElementByIdStub.returns({});
      googletagDefineSlotStub.callThrough();
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
          sizes: [ 'fluid', [ 605, 165 ] ]
        };

        return dfpService.initialize({
          slots: [ adSlot ]
        }).then(() => {
          expect(googletagDefineSlotStub.called).to.be.false;
        });
      });

      it('should register and refresh eagerly loaded slots', () => {
        const dfpService = newDfpService();

        getElementByIdStub.returns({});

        const adSlot: Moli.AdSlot = {
          position: 'in-page',
          domId: 'eager-loading-adslot',
          behaviour: 'eager',
          adUnitPath: '/123/eager',
          sizes: [ 'fluid', [ 605, 165 ] ]
        };

        return dfpService.initialize({
          slots: [ adSlot ]
        }).then(() => {
          expect(googletagDefineSlotStub.called).to.be.true;
        });
      });

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

        const pbjsAddAdUnitSpy = sandbox.spy(window.pbjs, 'addAdUnits');
        const pbjsRequestBidsSpy = sandbox.spy(window.pbjs, 'requestBids');
        const pbjsSetTargetingForGPTAsyncSpy = sandbox.spy(window.pbjs, 'setTargetingForGPTAsync');

        return dfpService.initialize({
          slots: [ adSlot ],
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
        targeting: {
          keyValues: [
            { key: 'gfversion', value: [ 'v2016' ] },
            { key: 'sprechstunde', value: 'true' }
          ]
        },
        sizeConfig: []
      };

      return moli.initialize(adConfiguration)
        .then(() => {
          expect(setTargetingStub).to.be.calledTwice;
          expect(setTargetingStub).to.be.calledWith('gfversion', Sinon.match.array.deepEquals([ 'v2016' ]));
          expect(setTargetingStub).to.be.calledWith('sprechstunde',  'true');
        });
    });
  });
});

// tslint:enable
