import browserEnv = require('browser-env');

browserEnv([ 'window', 'document' ]);

import { expect } from 'chai';
import * as Sinon from 'sinon';
import { DfpService, moli } from '../../../source/ts/ads/dfpService';
import { Moli } from '../../../source/ts/types/moli';
import { assetLoaderService } from '../../../source/ts/util/assetLoaderService';
import { cookieService } from '../../../source/ts/util/cookieService';
import { googletagStub } from '../stubs/googletagStubs';
import { pbjsStub } from '../stubs/prebidjsStubs';

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


      it.skip('should add prebidjs adUnits', () => {
        const dfpService = newDfpService();
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
          console.log('got promise');
        });
      });
    });
  });

  describe('setting key/value pairs', () => {

    beforeEach(() => {
      window.googletag = googletagStub;
      window.pbjs = pbjsStub;
    });

    it('should set correct targeting values', (done: Mocha.Done) => {
      const setTargetingStub = Sinon.stub(window.googletag.pubads(), 'setTargeting');

      // stub gpt loaded
      Sinon.stub(window.googletag.cmd, 'push').callsFake((fn: Function) => fn());

      // stub pbjs (prebid) loaded
      Sinon.stub(window.pbjs.que, 'push').callsFake((fn: Function) => fn());

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

      moli.initialize(adConfiguration)
        .then(() => {
          expect(setTargetingStub.callCount).to.be.eq(2);

          done();
        });
    });
  });
});

// tslint:enable
