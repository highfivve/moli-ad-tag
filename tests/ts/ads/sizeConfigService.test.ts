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
  const sizeConfigEntry4: SizeConfigEntry = {
    labels: [ 'desktop', 'video' ],
    sizesSupported: [ [ 205, 200 ], 'fluid' ],
    mediaQuery: 'min-width: 300px'
  };
  const sizeConfigEntry5: SizeConfigEntry = {
    labels: [ 'mobile', 'video', 'bottom' ],
    sizesSupported: [ [ 205, 200 ] ],
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
  const adSlot3: Moli.AdSlot = {
    position: 'in-page',
    domId: 'not-available-3',
    behaviour: 'eager',
    adUnitPath: '/123/eager-3',
    sizes: [ 'fluid', [ 985, 380 ] ],
    labelAny: [ 'video', 'visitor-uk' ]
  };
  const adSlot4: Moli.AdSlot = {
    position: 'in-page',
    domId: 'not-available-4',
    behaviour: 'eager',
    adUnitPath: '/123/eager-4',
    sizes: [ 'fluid', [ 985, 380 ] ],
    labelAll: [ 'video', 'visitor-uk' ]
  };
  const adSlot5: Moli.AdSlot = {
    position: 'in-page',
    domId: 'not-available-5',
    behaviour: 'eager',
    adUnitPath: '/123/eager-5',
    sizes: [ 'fluid', [ 985, 380 ] ],
    labelAny: [ 'video', 'visitor-uk' ],
    labelAll: [ 'video', 'visitor-uk' ]
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

      expect(
        new Set(filteredSizes)
      ).to.deep.equal(
        new Set([ [ 985, 380 ], [ 205, 200 ] ])
      );
    });

    it('should check if a given slot matches the configured slot size criteria', () => {
      const sizeConfigService = newSizeConfigService([ sizeConfigEntry1, sizeConfigEntry2 ], loggerStub);

      expect(sizeConfigService.filterSlot(adSlot1)).to.be.false;
      expect(sizeConfigService.filterSlot(adSlot2)).to.be.true;
    });

    it('should filter out duplicate labels from the label config', () => {
      const sizeConfigService = newSizeConfigService([ sizeConfigEntry4, sizeConfigEntry5 ], loggerStub);

      expect(
        new Set((sizeConfigService as any).supportedLabels as string[])
      ).to.deep.equal(
        new Set([ 'desktop', 'mobile', 'video', 'bottom' ])
      );
    });

    it('should check if given slots with labelAny/labelAll match the configured label criteria', () => {
      const sizeConfigService = newSizeConfigService([ sizeConfigEntry4, sizeConfigEntry5 ], loggerStub);

      // has labelAny "video" matching
      expect(sizeConfigService.filterSlot(adSlot3)).to.be.true;

      // has labelAll specified which contains "visitor-uk", but "visitor-uk" is not in supportedLabels
      expect(sizeConfigService.filterSlot(adSlot4)).to.be.false;

      // has both specified, but labelAll doesn't match and labelAny is ignored :(
      expect(sizeConfigService.filterSlot(adSlot5)).to.be.false;
    });
  });
});

// tslint:enable
