import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';

import { StickyHeaderAd } from './index';
import { createDomAndWindow } from 'ad-tag/stubs/browserEnvSetup';
import {
  emptyConfig,
  emptyRuntimeConfig,
  newGlobalAuctionContext,
  newNoopLogger,
  noopLogger
} from 'ad-tag/stubs/moliStubs';
import { AdSlot, Device, MoliConfig } from 'ad-tag/types/moliConfig';
import { MoliRuntime } from 'ad-tag/types/moliRuntime';
import { AdPipelineContext } from 'ad-tag/ads/adPipeline';
import { createGoogletagStub, googleAdSlotStub } from 'ad-tag/stubs/googletagStubs';

// setup sinon-chai
use(sinonChai);

describe('sticky header ad module', () => {
  const sandbox = Sinon.createSandbox();
  let { jsDomWindow } = createDomAndWindow();

  const adPipelineContext = (config: MoliConfig): AdPipelineContext => {
    return {
      auctionId__: 'xxxx-xxxx-xxxx-xxxx',
      requestId__: 0,
      requestAdsCalls__: 1,
      env__: 'production',
      logger__: noopLogger,
      config__: config,
      runtimeConfig__: emptyRuntimeConfig,
      window__: jsDomWindow,
      // no service dependencies required
      labelConfigService__: null as any,
      tcData__: null as any,
      adUnitPathVariables__: {},
      auction__: newGlobalAuctionContext(jsDomWindow),
      assetLoaderService__: null as any
    };
  };

  const createAdSlotConfig = (domId: string, device: Device): MoliRuntime.SlotDefinition => {
    const adUnitPath = '/1/' + domId;
    const moliSlot: AdSlot = {
      domId: domId,
      adUnitPath: adUnitPath,
      position: 'in-page',
      sizes: [[300, 250]],
      behaviour: { loaded: 'eager' },
      labelAll: [],
      labelAny: ['desktop'],
      sizeConfig: [
        {
          mediaQuery: device === 'mobile' ? '(max-width: 767px)' : '(min-width: 767px)',
          sizesSupported: [[300, 250]]
        }
      ]
    };

    const adSlot = googleAdSlotStub(adUnitPath, domId);
    return { moliSlot, adSlot, filterSupportedSizes: undefined as any };
  };

  const moliConfig = (slots: MoliRuntime.SlotDefinition[]): MoliConfig => ({
    ...emptyConfig,
    slots: slots.map(slot => slot.moliSlot)
  });

  const headerAdDomId = 'ad-desktop-sticky';
  const fadeOutClassName = 'fade-out';
  const fadeOutTriggerSelector = '.trigger';

  const createStickyHeaderAdModule = (
    headerAdDomId: string,
    disallowedAdvertiserIds: number[] = []
  ): StickyHeaderAd => {
    const module = new StickyHeaderAd();
    module.configure__({
      stickyHeaderAd: {
        enabled: true,
        headerAdDomId,
        fadeOutClassName,
        disallowedAdvertiserIds,
        fadeOutTrigger: {
          selector: fadeOutTriggerSelector
        }
      }
    });
    return module;
  };

  beforeEach(() => {
    jsDomWindow.googletag = createGoogletagStub();
  });

  afterEach(() => {
    jsDomWindow = createDomAndWindow().jsDomWindow;
    sandbox.reset();
    sandbox.resetHistory();
  });

  describe('Initialize sticky-header', () => {
    it('should add an configure step', async () => {
      const module = createStickyHeaderAdModule(headerAdDomId, [111]);

      const configureSteps = module.configureSteps__();
      expect(configureSteps).to.have.lengthOf(1);
      expect(configureSteps[0].name).to.be.eq('sticky-header-ads:cleanup');
    });

    it('should add a prepare request ads pipeline step', async () => {
      const module = createStickyHeaderAdModule(headerAdDomId, [111]);

      const prepareRequestAdsSteps = module.prepareRequestAdsSteps__();
      expect(prepareRequestAdsSteps).to.have.lengthOf(1);
      expect(prepareRequestAdsSteps[0].name).to.be.eq('sticky-header-ads');
    });

    it('should not initialize sticky-header if header is not requested', async () => {
      const querySelectorSpy = sandbox.spy(jsDomWindow.document, 'querySelector');
      const module = createStickyHeaderAdModule(headerAdDomId, [111]);

      const contentSlot1 = createAdSlotConfig('content-1', 'desktop');

      const step = module.prepareRequestAdsSteps__()[0];

      await step(adPipelineContext(moliConfig([contentSlot1])), [contentSlot1]);

      expect(querySelectorSpy).to.have.callCount(0);
    });

    it('should not initialize sticky-header if header is not in DOM', async () => {
      const querySelectorStub = sandbox.stub(jsDomWindow.document, 'querySelector');
      querySelectorStub.returns(null);
      const newLogger = newNoopLogger();
      const loggerSpy = sandbox.spy(newLogger, 'warn');
      const module = createStickyHeaderAdModule(headerAdDomId, [111]);

      const contentSlot1 = createAdSlotConfig(headerAdDomId, 'desktop');

      const step = module.prepareRequestAdsSteps__()[0];
      await step({ ...adPipelineContext(moliConfig([contentSlot1])), logger__: newLogger }, [
        contentSlot1
      ]);

      expect(querySelectorStub).to.have.been.calledOnce;
      expect(loggerSpy).to.have.been.calledOnce;
      expect(loggerSpy).to.have.been.calledOnceWithExactly(
        'sticky-header-ads',
        'Could not find sticky header container with selector \'[data-ref="header-ad"]\''
      );
    });
  });
});
