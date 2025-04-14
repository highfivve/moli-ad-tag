import { dom } from '../stubs/browserEnvSetup';

import { expect, use } from 'chai';
import sinonChai from 'sinon-chai';
import * as Sinon from 'sinon';

import { createLabelConfigService } from './labelConfigService';
import { AdSlot, sizeConfigs } from '../types/moliConfig';

// setup sinon-chai
use(sinonChai);

describe('LabelConfigConfigService', () => {
  const sandbox = Sinon.createSandbox();
  const labelConfigEntry1: sizeConfigs.LabelSizeConfigEntry = {
    mediaQuery: 'min-width: 300px',
    labelsSupported: ['desktop', 'video']
  };
  const labelConfigEntry2: sizeConfigs.LabelSizeConfigEntry = {
    mediaQuery: 'min-width: 300px',
    labelsSupported: ['mobile', 'video', 'bottom']
  };
  const labelConfigEntryWithoutLabels: sizeConfigs.LabelSizeConfigEntry = {
    mediaQuery: 'min-width: 300px',
    labelsSupported: []
  };
  const adSlotWithLabelAny: AdSlot = {
    position: 'in-page',
    domId: 'not-available-3',
    behaviour: { loaded: 'eager' },
    adUnitPath: '/123/eager-3',
    sizes: ['fluid', [985, 380]],
    sizeConfig: [],
    labelAny: ['video', 'visitor-uk']
  };
  const adSlotWithLabelAll: AdSlot = {
    position: 'in-page',
    domId: 'not-available-4',
    behaviour: { loaded: 'eager' },
    adUnitPath: '/123/eager-4',
    sizes: ['fluid', [985, 380]],
    sizeConfig: [],
    labelAll: ['video', 'visitor-uk']
  };
  const adSlotWithLabelAnyLabelAll: AdSlot = {
    position: 'in-page',
    domId: 'not-available-5',
    behaviour: { loaded: 'eager' },
    adUnitPath: '/123/eager-5',
    sizes: ['fluid', [985, 380]],
    sizeConfig: [],
    labelAny: ['video', 'visitor-uk'],
    labelAll: ['video', 'visitor-uk']
  };

  const adSlotWithDifferentLabelAnyLabelAll: AdSlot = {
    position: 'in-page',
    domId: 'not-available-5',
    behaviour: { loaded: 'eager' },
    adUnitPath: '/123/eager-5',
    sizes: ['fluid', [985, 380]],
    sizeConfig: [],
    labelAny: ['video'],
    labelAll: ['desktop', 'bottom']
  };

  const jsDomWindow: Window = dom.window as any;
  const matchMediaStub = sandbox.stub(jsDomWindow, 'matchMedia');

  const newLabelConfigService = (
    labelConfig: sizeConfigs.LabelSizeConfigEntry[],
    extraLabels: string[] = []
  ) => createLabelConfigService(labelConfig, extraLabels, jsDomWindow);

  afterEach(() => {
    sandbox.reset();
  });

  after(() => {
    sandbox.restore();
  });

  describe('slot label matching logic', () => {
    it('should let the given slot pass if label configuration is empty', () => {
      matchMediaStub.returns({ matches: true } as MediaQueryList);
      const slotPassed = newLabelConfigService([labelConfigEntryWithoutLabels]).filterSlot(
        adSlotWithLabelAll
      );

      expect(slotPassed).to.be.true;
    });

    it('should filter out duplicate labels from the label config', () => {
      matchMediaStub.returns({ matches: true } as MediaQueryList);
      const labelConfigService = createLabelConfigService(
        [labelConfigEntry1, labelConfigEntry2],
        [],
        jsDomWindow
      );

      expect(new Set(labelConfigService.getSupportedLabels())).to.deep.equal(
        new Set(['desktop', 'mobile', 'video', 'bottom'])
      );
    });

    it('should check if given slots with labelAny/labelAll match the configured label criteria', () => {
      matchMediaStub.returns({ matches: true } as MediaQueryList);
      const sizeConfigService = newLabelConfigService([labelConfigEntry1, labelConfigEntry2]);
      expect(sizeConfigService.getSupportedLabels()).to.deep.equal([
        'desktop',
        'video',
        'mobile',
        'bottom'
      ]);

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
      const labelConfigService = createLabelConfigService(
        [],
        ['desktop', 'mobile', 'video', 'bottom'],
        jsDomWindow
      );
      expect(new Set(labelConfigService.getSupportedLabels())).to.deep.equal(
        new Set(['desktop', 'mobile', 'video', 'bottom'])
      );
    });

    it('should allow slots with a single value in labelAny', () => {
      const sizeConfigService = newLabelConfigService([], ['check']);
      expect(sizeConfigService.filterSlot({ labelAny: ['check'] })).to.be.true;
    });
  });

  describe('device labels', () => {
    [
      { labels: [], deviceLabel: 'mobile' },
      { labels: ['mobile', 'test'], deviceLabel: 'mobile' },
      { labels: ['desktop', 'mobile'], deviceLabel: 'desktop' },
      { labels: ['desktop'], deviceLabel: 'desktop' },
      { labels: ['android'], deviceLabel: 'android' },
      { labels: ['ios'], deviceLabel: 'ios' },
      { labels: ['ios', 'mobile', 'test'], deviceLabel: 'ios' },
      { labels: ['android', 'mobile', 'test'], deviceLabel: 'android' }
    ].forEach(({ labels, deviceLabel }) => {
      it(`should return ${deviceLabel} if labels are [${labels.join(',')}]`, () => {
        const sizeConfigService = newLabelConfigService([], labels);
        expect(sizeConfigService.getDeviceLabel()).to.be.equals(deviceLabel);
      });
    });
  });

  describe('extraLabels overriding labelSizeConfig', () => {
    const inputs = [
      { labels: ['mobile'], deviceLabel: 'mobile' },
      { labels: ['desktop'], deviceLabel: 'desktop' },
      { labels: ['ios'], deviceLabel: 'ios' },
      { labels: ['android', 'test'], deviceLabel: 'android' }
    ];
    inputs.forEach(({ labels, deviceLabel }) => {
      it(`should return ${deviceLabel} if labels are [${labels.join(',')}] and matchMedia matches:true`, () => {
        matchMediaStub.returns({ matches: true } as MediaQueryList);
        const sizeConfigService = newLabelConfigService([labelConfigEntry1], labels);
        expect(sizeConfigService.getDeviceLabel()).to.be.equals(deviceLabel);
      });
    });

    inputs.forEach(({ labels, deviceLabel }) => {
      it(`should return ${deviceLabel} if labels are [${labels.join(',')}] and matchMedia matches:false`, () => {
        matchMediaStub.returns({ matches: false } as MediaQueryList);
        const sizeConfigService = newLabelConfigService([labelConfigEntry1], labels);
        expect(sizeConfigService.getDeviceLabel()).to.be.equals(deviceLabel);
      });
    });
  });
});
