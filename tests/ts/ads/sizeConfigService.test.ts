import '../stubs/browserEnvSetup';

import { expect, use } from 'chai';
import * as sinonChai from 'sinon-chai';
import * as Sinon from 'sinon';

import { SizeConfigService } from '../../../source/ts/ads/sizeConfigService';
import { Moli } from '../../../source/ts';

import MoliLogger = Moli.MoliLogger;
import SizeConfigEntry = Moli.SizeConfigEntry;
import DfpSlotSize = Moli.DfpSlotSize;

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
  const sizeConfigEntry1: SizeConfigEntry = {
    labels: [],
    sizesSupported: [ [ 205, 200 ], 'fluid' ],
    mediaQuery: 'min-width: 300px'
  };
  const sizeConfigEntry2: SizeConfigEntry = {
    labels: [],
    sizesSupported: [ [ 205, 200 ] ],
    mediaQuery: 'min-width: 300px'
  };
  const sizeConfigEntry3: SizeConfigEntry = {
    labels: [],
    sizesSupported: [ [ 985, 380 ], 'fluid' ],
    mediaQuery: 'min-width: 300px'
  };
  const adSlot1: Moli.AdSlot = {
    position: 'in-page',
    domId: 'not-available',
    behaviour: 'eager',
    adUnitPath: '/123/eager',
    sizes: [ [ 605, 165 ] ]
  };
  const adSlot2: Moli.AdSlot = {
    position: 'in-page',
    domId: 'not-available-2',
    behaviour: 'eager',
    adUnitPath: '/123/eager-2',
    sizes: [ 'fluid', [ 985, 380 ] ]
  };
  const defaultSizeConfig: SizeConfigEntry[] = [];
  const newSizeConfigService = (sizeConfig: SizeConfigEntry[], logger: MoliLogger) => new SizeConfigService(sizeConfig, logger);

  afterEach(() => {
    sandbox.reset();
  });

  describe('slot size matching logic', () => {

    it('should return an empty array when passed an empty array', () => {
      const sizeConfigService = newSizeConfigService(defaultSizeConfig, loggerStub);

      const filteredSizes = sizeConfigService.filterSupportedSizes([]);

      expect(filteredSizes).to.deep.equal([]);
    });

    it('should warn if config is empty', () => {
      const filteredSizes = newSizeConfigService(defaultSizeConfig, loggerStub).filterSupportedSizes([]);

      expect(warnStub).to.have.been.calledOnce;
      expect(filteredSizes).to.deep.equal([]);
    });

    it('should filter out duplicate slots from the size config', () => {
      const sizeConfigService = newSizeConfigService([ sizeConfigEntry1, sizeConfigEntry2 ], loggerStub);

      expect((sizeConfigService as any).supportedSizes as DfpSlotSize[]).to.deep.equal([ [ 205, 200 ], 'fluid' ]);
    });

    it('should filter the given slots according to configuration', () => {
      const filteredSizes = newSizeConfigService([ sizeConfigEntry1, sizeConfigEntry2, sizeConfigEntry3 ], loggerStub)
        .filterSupportedSizes([ [ 985, 380 ], [ 205, 200 ], [ 350, 200 ], [ 1, 1 ] ]);

      expect(new Set(filteredSizes)).to.deep.equal(new Set([ [ 985, 380 ], [ 205, 200 ] ]));
    });

    it('should check if a given slot matches the configured slot size criteria', () => {
      const sizeConfigService = newSizeConfigService([ sizeConfigEntry1, sizeConfigEntry2 ], loggerStub);

      expect(sizeConfigService.filterSlot(adSlot1)).to.be.false;
      expect(sizeConfigService.filterSlot(adSlot2)).to.be.true;
    });
  });
});

// tslint:enable
