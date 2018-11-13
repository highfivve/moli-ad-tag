import { expect, use } from 'chai';
import * as sinonChai from 'sinon-chai';
import * as Sinon from 'sinon';

import { SizeConfigService } from '../../../source/ts/ads/sizeConfigService';
import { Moli } from '../../../source/ts';

import MoliLogger = Moli.MoliLogger;
import IAdSlot = Moli.IAdSlot;

// setup sinon-chai
use(sinonChai);

// tslint:disable: no-unused-expression
describe('SizeConfigService', () => {
  const sandbox = Sinon.createSandbox();
  const warnStub = sandbox.stub();
  const loggerStub: MoliLogger = {
    debug: sandbox.stub(),
    info: sandbox.stub(),
    warn: warnStub,
    error: sandbox.stub()
  };
  const eagerSlot = {
    position: 'in-page',
    domId: 'not-available',
    behaviour: 'eager',
    adUnitPath: '/123/eager',
    sizes: ['fluid', [605, 165]]
  } as IAdSlot;
  const newSizeConfigService = (logger: MoliLogger) => new SizeConfigService(logger);

  afterEach(() => {
    sandbox.reset();
  });

  describe('slot matching logic', () => {

    it('should return an empty array when passed an empty array', () => {
      const sizeConfigService = newSizeConfigService(loggerStub);
      sizeConfigService.initialize([ eagerSlot ]);

      const filteredSizes = sizeConfigService.filterSupportedSizes([]);

      expect(filteredSizes).to.deep.equal([]);
    });

    it('should warn if config is empty', () => {
      const filteredSizes = newSizeConfigService(loggerStub).filterSupportedSizes([]);

      expect(warnStub).to.have.been.calledOnce;
      expect(filteredSizes).to.deep.equal([]);
    });

    it.skip('should filter the given slots according to configuration', () => {
      const filteredSizes = newSizeConfigService(loggerStub).filterSupportedSizes([]);

      expect(filteredSizes).to.deep.equal([]);
    });
  });
});

// tslint:enable
