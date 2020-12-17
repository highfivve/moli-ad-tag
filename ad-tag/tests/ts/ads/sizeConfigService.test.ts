import { dom } from '../stubs/browserEnvSetup';

import { expect, use } from 'chai';
import sinonChai from 'sinon-chai';
import * as Sinon from 'sinon';

import { SizeConfigService } from '../../../source/ts/ads/sizeConfigService';
import { Moli } from '../../../source/ts/types/moli';

import SizeConfigEntry = Moli.SizeConfigEntry;
import DfpSlotSize = Moli.DfpSlotSize;

// setup sinon-chai
use(sinonChai);

// tslint:disable: no-unused-expression
describe('SizeConfigService', () => {
  const sandbox = Sinon.createSandbox();
  const sizeConfigEntry1: SizeConfigEntry = {
    sizesSupported: [[205, 200], 'fluid'],
    mediaQuery: 'min-width: 300px'
  };
  const sizeConfigEntry2: SizeConfigEntry = {
    sizesSupported: [[205, 200]],
    mediaQuery: 'min-width: 300px'
  };
  const sizeConfigEntry3: SizeConfigEntry = {
    sizesSupported: [[985, 380], 'fluid'],
    mediaQuery: 'min-width: 300px'
  };
  const sizeConfigEntryWithoutSizes: SizeConfigEntry = {
    sizesSupported: [],
    mediaQuery: 'min-width: 300px'
  };
  const outOfPageSlot: Moli.AdSlot = {
    position: 'out-of-page',
    domId: 'not-available',
    behaviour: { loaded: 'eager' },
    adUnitPath: '/123/eager-oop',
    sizes: [],
    sizeConfig: []
  };
  const adSlot605x165: Moli.AdSlot = {
    position: 'in-page',
    domId: 'not-available',
    behaviour: { loaded: 'eager' },
    adUnitPath: '/123/eager',
    sizes: [[605, 165]],
    sizeConfig: []
  };
  const adSlotFluid985x380: Moli.AdSlot = {
    position: 'in-page',
    domId: 'not-available-2',
    behaviour: { loaded: 'eager' },
    adUnitPath: '/123/eager-2',
    sizes: ['fluid', [985, 380]],
    sizeConfig: []
  };

  const emptySizeConfig: SizeConfigEntry[] = [];
  const jsDomWindow: Window = dom.window as any;
  const newSizeConfigService = (sizeConfig: SizeConfigEntry[]) =>
    new SizeConfigService(sizeConfig, jsDomWindow);

  afterEach(() => {
    sandbox.reset();
  });

  after(() => {
    sandbox.restore();
  });

  describe('slot size matching logic', () => {
    it('should return an empty array when passed an empty array', () => {
      const sizeConfigService = newSizeConfigService(emptySizeConfig);

      const filteredSizes = sizeConfigService.filterSupportedSizes([]);

      expect(filteredSizes).to.deep.equal([]);
    });

    it("should filter all sizes if config is not empty but no slot's matchMedia matches", () => {
      // for this test, we assume no sizeConfig mediaQuery matches:
      const matchMediaStub = sandbox
        .stub(dom.window, 'matchMedia')
        .returns({ matches: false } as MediaQueryList);

      const sizeConfigService = newSizeConfigService([sizeConfigEntry3]);

      expect(sizeConfigService.filterSupportedSizes([[985, 380], 'fluid'])).to.deep.equal([]);

      matchMediaStub.restore();
    });

    it('should filter out duplicate slots from the size config', () => {
      const sizeConfigService = newSizeConfigService([sizeConfigEntry1, sizeConfigEntry2]);

      expect((sizeConfigService as any).supportedSizes as DfpSlotSize[]).to.deep.equal([
        [205, 200],
        'fluid'
      ]);
    });

    it('should filter the given slots according to configuration', () => {
      const filteredSizes = newSizeConfigService([
        sizeConfigEntry1,
        sizeConfigEntry2,
        sizeConfigEntry3
      ]).filterSupportedSizes([
        [985, 380],
        [205, 200],
        [350, 200],
        [1, 1]
      ]);

      expect(new Set(filteredSizes)).to.deep.equal(
        new Set([
          [985, 380],
          [205, 200]
        ])
      );
    });

    it('should not change the given slot sizes if size configuration is empty', () => {
      const filteredSizes = newSizeConfigService([
        sizeConfigEntryWithoutSizes
      ]).filterSupportedSizes([
        [985, 380],
        [205, 200],
        [350, 200],
        [1, 1]
      ]);

      expect(new Set(filteredSizes)).to.deep.equal(
        new Set([
          [985, 380],
          [205, 200],
          [350, 200],
          [1, 1]
        ])
      );
    });

    it('should let the given slot pass if it is an out-of-page slot with empty sizes', () => {
      const slotPassed = newSizeConfigService([sizeConfigEntryWithoutSizes]).filterSlot(
        outOfPageSlot
      );

      expect(slotPassed).to.be.true;
    });

    it('should check if a given slot matches the configured slot size criteria', () => {
      const sizeConfigService = newSizeConfigService([sizeConfigEntry1, sizeConfigEntry2]);

      expect(sizeConfigService.filterSlot(adSlot605x165)).to.be.false;
      expect(sizeConfigService.filterSlot(adSlotFluid985x380)).to.be.true;
    });
  });
});

// tslint:enable
