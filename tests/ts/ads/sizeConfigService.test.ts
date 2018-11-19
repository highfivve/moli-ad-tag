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
  const debugStub = sandbox.stub();
  const loggerStub: MoliLogger = {
    debug: debugStub,
    info: sandbox.stub(),
    warn: sandbox.stub(),
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
  const sizeConfigEntryWithoutSizes: SizeConfigEntry = {
    labels: [ 'mobile', 'video', 'bottom' ],
    sizesSupported: [],
    mediaQuery: 'min-width: 300px'
  };
  const sizeConfigEntryWithoutLabels: SizeConfigEntry = {
    labels: [],
    sizesSupported: [ 'fluid' ],
    mediaQuery: 'min-width: 300px'
  };
  const outOfPageSlot: Moli.AdSlot = {
    position: 'out-of-page',
    domId: 'not-available',
    behaviour: 'eager',
    adUnitPath: '/123/eager-oop',
    sizes: []
  };
  const adSlot605x165: Moli.AdSlot = {
    position: 'in-page',
    domId: 'not-available',
    behaviour: 'eager',
    adUnitPath: '/123/eager',
    sizes: [ [ 605, 165 ] ]
  };
  const adSlotFluid985x380: Moli.AdSlot = {
    position: 'in-page',
    domId: 'not-available-2',
    behaviour: 'eager',
    adUnitPath: '/123/eager-2',
    sizes: [ 'fluid', [ 985, 380 ] ]
  };
  const adSlotWithLabelAny: Moli.AdSlot = {
    position: 'in-page',
    domId: 'not-available-3',
    behaviour: 'eager',
    adUnitPath: '/123/eager-3',
    sizes: [ 'fluid', [ 985, 380 ] ],
    labelAny: [ 'video', 'visitor-uk' ]
  };
  const adSlotWithLabelAll: Moli.AdSlot = {
    position: 'in-page',
    domId: 'not-available-4',
    behaviour: 'eager',
    adUnitPath: '/123/eager-4',
    sizes: [ 'fluid', [ 985, 380 ] ],
    labelAll: [ 'video', 'visitor-uk' ]
  };
  const adSlotWithLabelAnyLabelAll: Moli.AdSlot = {
    position: 'in-page',
    domId: 'not-available-5',
    behaviour: 'eager',
    adUnitPath: '/123/eager-5',
    sizes: [ 'fluid', [ 985, 380 ] ],
    labelAny: [ 'video', 'visitor-uk' ],
    labelAll: [ 'video', 'visitor-uk' ]
  };
  const emptySizeConfig: SizeConfigEntry[] = [];
  const newSizeConfigService = (sizeConfig: SizeConfigEntry[], logger: MoliLogger) => new SizeConfigService(sizeConfig, [], logger);

  afterEach(() => {
    sandbox.reset();
  });

  describe('slot size matching logic', () => {

    it('should return an empty array when passed an empty array', () => {
      const sizeConfigService = newSizeConfigService(emptySizeConfig, loggerStub);

      const filteredSizes = sizeConfigService.filterSupportedSizes([]);

      expect(filteredSizes).to.deep.equal([]);
    });

    it('should warn if config is not empty but no slot\'s matchMedia matches', () => {
      // for this test, we assume no sizeConfig mediaQuery matches:
      const matchMediaStub = sandbox.stub(window, 'matchMedia').returns({ matches: false });

      newSizeConfigService([ sizeConfigEntry3 ], loggerStub);

      expect(debugStub).to.have.been.calledOnce;

      matchMediaStub.restore();
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

    it('should not change the given slot sizes if size configuration is empty', () => {
      const filteredSizes = newSizeConfigService([ sizeConfigEntryWithoutSizes ], loggerStub)
        .filterSupportedSizes([ [ 985, 380 ], [ 205, 200 ], [ 350, 200 ], [ 1, 1 ] ]);

      expect(
        new Set(filteredSizes)
      ).to.deep.equal(
        new Set([ [ 985, 380 ], [ 205, 200 ], [ 350, 200 ], [ 1, 1 ] ])
      );
    });

    it('should let the given slot pass if label configuration is empty', () => {
      const slotPassed = newSizeConfigService([ sizeConfigEntryWithoutLabels ], loggerStub)
        .filterSlot(adSlotWithLabelAll);

      expect(slotPassed).to.be.true;
    });

    it('should let the given slot pass if it is an out-of-page slot with empty sizes', () => {
      const slotPassed = newSizeConfigService([ sizeConfigEntry5 ], loggerStub)
        .filterSlot(outOfPageSlot);

      expect(slotPassed).to.be.true;
    });

    it('should check if a given slot matches the configured slot size criteria', () => {
      const sizeConfigService = newSizeConfigService([ sizeConfigEntry1, sizeConfigEntry2 ], loggerStub);

      expect(sizeConfigService.filterSlot(adSlot605x165)).to.be.false;
      expect(sizeConfigService.filterSlot(adSlotFluid985x380)).to.be.true;
    });

    it('should filter out duplicate labels from the label config', () => {
      const sizeConfigService = newSizeConfigService([ sizeConfigEntry4, sizeConfigEntry5 ], loggerStub);

      expect(
        new Set(sizeConfigService.getSupportedLabels())
      ).to.deep.equal(
        new Set([ 'desktop', 'mobile', 'video', 'bottom' ])
      );
    });

    it('should check if given slots with labelAny/labelAll match the configured label criteria', () => {
      const sizeConfigService = newSizeConfigService([ sizeConfigEntry4, sizeConfigEntry5 ], loggerStub);

      // has labelAny "video" matching
      expect(sizeConfigService.filterSlot(adSlotWithLabelAny)).to.be.true;

      // has labelAll specified which contains "visitor-uk", but "visitor-uk" is not in supportedLabels
      expect(sizeConfigService.filterSlot(adSlotWithLabelAll)).to.be.false;

      // has both specified, but labelAll doesn't match and labelAny is ignored :(
      expect(sizeConfigService.filterSlot(adSlotWithLabelAnyLabelAll)).to.be.false;
    });

    it('should add the extra labels to the supported labels', () => {
      const sizeConfigService = new SizeConfigService([], [ 'desktop', 'mobile', 'video', 'bottom' ], loggerStub);
      expect(
        new Set(sizeConfigService.getSupportedLabels())
      ).to.deep.equal(
        new Set([ 'desktop', 'mobile', 'video', 'bottom' ])
      );
    });
  });
});

// tslint:enable
