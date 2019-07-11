import { dom } from '../stubs/browserEnvSetup';

import { expect, use } from 'chai';
import * as sinonChai from 'sinon-chai';
import * as Sinon from 'sinon';

import { Moli } from '../../../source/ts';

import { LabelConfigService } from '../../../source/ts/ads/labelConfigService';
import LabelSizeConfigEntry = Moli.LabelSizeConfigEntry;

// setup sinon-chai
use(sinonChai);

// tslint:disable: no-unused-expression
describe('LabelConfigConfigService', () => {
  const sandbox = Sinon.createSandbox();
  const labelConfigEntry1: LabelSizeConfigEntry = {
    mediaQuery: 'min-width: 300px',
    labelsSupported: [ 'desktop', 'video' ]
  };
  const labelConfigEntry2: LabelSizeConfigEntry = {
    mediaQuery: 'min-width: 300px',
    labelsSupported: [ 'mobile', 'video', 'bottom' ]
  };
  const labelConfigEntryWithoutLabels: LabelSizeConfigEntry = {
    mediaQuery: 'min-width: 300px',
    labelsSupported: []
  };
  const outOfPageSlot: Moli.AdSlot = {
    position: 'out-of-page',
    domId: 'not-available',
    behaviour: 'eager',
    adUnitPath: '/123/eager-oop',
    sizes: [],
    sizeConfig: []
  };
  const adSlotWithLabelAny: Moli.AdSlot = {
    position: 'in-page',
    domId: 'not-available-3',
    behaviour: 'eager',
    adUnitPath: '/123/eager-3',
    sizes: [ 'fluid', [ 985, 380 ] ],
    sizeConfig: [],
    labelAny: [ 'video', 'visitor-uk' ]
  };
  const adSlotWithLabelAll: Moli.AdSlot = {
    position: 'in-page',
    domId: 'not-available-4',
    behaviour: 'eager',
    adUnitPath: '/123/eager-4',
    sizes: [ 'fluid', [ 985, 380 ] ],
    sizeConfig: [],
    labelAll: [ 'video', 'visitor-uk' ]
  };
  const adSlotWithLabelAnyLabelAll: Moli.AdSlot = {
    position: 'in-page',
    domId: 'not-available-5',
    behaviour: 'eager',
    adUnitPath: '/123/eager-5',
    sizes: [ 'fluid', [ 985, 380 ] ],
    sizeConfig: [],
    labelAny: [ 'video', 'visitor-uk' ],
    labelAll: [ 'video', 'visitor-uk' ]
  };

  const adSlotWithDifferentLabelAnyLabelAll: Moli.AdSlot = {
    position: 'in-page',
    domId: 'not-available-5',
    behaviour: 'eager',
    adUnitPath: '/123/eager-5',
    sizes: [ 'fluid', [ 985, 380 ] ],
    sizeConfig: [],
    labelAny: [ 'video' ],
    labelAll: [ 'desktop', 'bottom' ]
  };

  const newLabelConfigService = (labelConfig: LabelSizeConfigEntry[]) => new LabelConfigService(labelConfig, [], dom.window);

  afterEach(() => {
    sandbox.reset();
  });

  after(() => {
    sandbox.restore();
  });

  describe('slot label matching logic', () => {


    it('should let the given slot pass if label configuration is empty', () => {
      const slotPassed = newLabelConfigService([ labelConfigEntryWithoutLabels ])
        .filterSlot(adSlotWithLabelAll);

      expect(slotPassed).to.be.true;
    });

    it('should filter out duplicate labels from the label config', () => {
      const labelConfigService = new LabelConfigService([ labelConfigEntry1, labelConfigEntry2 ], [], dom.window);

      expect(
        new Set(labelConfigService.getSupportedLabels())
      ).to.deep.equal(
        new Set([ 'desktop', 'mobile', 'video', 'bottom' ])
      );
    });

    it('should check if given slots with labelAny/labelAll match the configured label criteria', () => {
      const sizeConfigService = newLabelConfigService([ labelConfigEntry1, labelConfigEntry2 ]);
      expect(sizeConfigService.getSupportedLabels()).to.deep.equal([ 'desktop', 'video', 'mobile', 'bottom' ]);

      // has labelAny "video" matching
      expect(sizeConfigService.filterSlot(adSlotWithLabelAny)).to.be.true;

      // has labelAll specified which contains "visitor-uk", but "visitor-uk" is not in supportedLabels
      expect(sizeConfigService.filterSlot(adSlotWithLabelAll)).to.be.false;

      // has both specified, but labelAll doesn't match and labelAny is ignored :(
      expect(sizeConfigService.filterSlot(adSlotWithLabelAnyLabelAll)).to.be.false;

      // has both specific and both match
      expect(sizeConfigService.filterSlot(adSlotWithDifferentLabelAnyLabelAll)).to.be.true;
    });

    it('should add the extra labels to the supported labels', () => {
      const labelConfigService = new LabelConfigService([], [ 'desktop', 'mobile', 'video', 'bottom' ], dom.window);
      expect(
        new Set(labelConfigService.getSupportedLabels())
      ).to.deep.equal(
        new Set([ 'desktop', 'mobile', 'video', 'bottom' ])
      );
    });
  });
});

// tslint:enable
