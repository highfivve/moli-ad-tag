import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';

import { createDom } from '@highfivve/ad-tag/lib/stubs/browserEnvSetup';
import { createGoogletagStub, googleAdSlotStub } from '@highfivve/ad-tag/lib/stubs/googletagStubs';
import { dummySchainConfig } from '@highfivve/ad-tag/lib/stubs/schainStubs';
import { reportingServiceStub } from '@highfivve/ad-tag/lib/stubs/reportingServiceStub';
import { noopLogger } from '@highfivve/ad-tag/lib/stubs/moliStubs';
import {
  googletag,
  prebidjs,
  MoliRuntime,
  AdPipeline,
  AdPipelineContext,
  IAdPipelineConfiguration
} from '@highfivve/ad-tag';

import Device = MoliRuntime.Device;
import { StickyHeaderAds, StickyHeaderAdConfig, StickyHeaderFadeOutConfig } from './index';
import ISlotRenderEndedEvent = googletag.events.ISlotRenderEndedEvent;
import ISlotOnloadEvent = googletag.events.ISlotOnloadEvent;
import { GlobalAuctionContext } from '@highfivve/ad-tag/lib/ads/globalAuctionContext';

// setup sinon-chai
use(sinonChai);

describe('sticky header ad module', () => {
  const sandbox = Sinon.createSandbox();
  let dom = createDom();
  let jsDomWindow: Window & googletag.IGoogleTagWindow & prebidjs.IPrebidjsWindow =
    dom.window as any;

  const reportingService = reportingServiceStub();

  const emptyPipelineConfig: IAdPipelineConfiguration = {
    init: [],
    configure: [],
    defineSlots: () => Promise.resolve([]),
    prepareRequestAds: [],
    requestBids: [],
    requestAds: () => Promise.resolve()
  };
  const adPipelineContext = (config: MoliRuntime.MoliConfig): AdPipelineContext => {
    return {
      requestId: 0,
      requestAdsCalls: 1,
      env: 'production',
      logger: noopLogger,
      config: config,
      window: jsDomWindow,
      // no service dependencies required
      labelConfigService: null as any,
      reportingService: null as any,
      tcData: null as any,
      adUnitPathVariables: {},
      auction: new GlobalAuctionContext(jsDomWindow)
    };
  };

  const createAdSlotConfig = (domId: string, device: Device): MoliRuntime.SlotDefinition => {
    const adUnitPath = '/1/' + domId;
    const moliSlot: MoliRuntime.AdSlot = {
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

  const headerAdDomId = 'ad-desktop-sticky';
  const fadeOutClassName = 'fade-out';
  const fadeOutTriggerSelector = '.trigger';

  const createStickyHeaderAdModule = (
    headerAdDomId: string,
    disallowedAdvertiserIds: number[] = [],
    waitForRendering: boolean = true
  ): StickyHeaderAds => {
    return new StickyHeaderAds({
      headerAdDomId,
      fadeOutClassName,
      disallowedAdvertiserIds,
      waitForRendering,
      fadeOutTrigger: {
        selector: fadeOutTriggerSelector
      }
    });
  };

  const initModule = (
    moliSlots: MoliRuntime.AdSlot[] = [],
    configPipeline?: MoliRuntime.pipeline.PipelineConfig
  ) => {
    const moliConfig: MoliRuntime.MoliConfig = {
      slots: moliSlots,
      pipeline: configPipeline,
      logger: noopLogger,
      schain: dummySchainConfig
    };

    const adPipeline = new AdPipeline(
      emptyPipelineConfig,
      noopLogger,
      jsDomWindow,
      reportingService,
      new GlobalAuctionContext(jsDomWindow)
    );

    return { moliConfig, adPipeline };
  };

  beforeEach(() => {
    jsDomWindow.googletag = createGoogletagStub();
  });

  afterEach(() => {
    dom = createDom();
    jsDomWindow = dom.window as any;
    sandbox.reset();
    sandbox.resetHistory();
  });

  describe('Initialize sticky-header', () => {
    it('should add an init step', async () => {
      const module = createStickyHeaderAdModule(headerAdDomId, [111], true);

      const desktopSlot = createAdSlotConfig(headerAdDomId, 'desktop');
      const { moliConfig, adPipeline } = initModule([desktopSlot.moliSlot]);

      module.init(moliConfig);

      expect(moliConfig.pipeline).to.be.ok;
      expect(moliConfig.pipeline?.configureSteps).to.have.lengthOf(1);
      expect(moliConfig.pipeline?.configureSteps[0].name).to.be.eq('sticky-header-ads:cleanup');
      expect(moliConfig.pipeline?.prepareRequestAdsSteps).to.have.lengthOf(1);
      expect(moliConfig.pipeline?.prepareRequestAdsSteps[0].name).to.be.eq('sticky-header-ads');
    });

    it('should not initialize sticky-header if header is not requested', async () => {
      const querySelectorSpy = sandbox.spy(jsDomWindow.document, 'querySelector');
      const module = createStickyHeaderAdModule(headerAdDomId, [111], true);

      const contentSlot1 = createAdSlotConfig('content-1', 'desktop');
      const { moliConfig, adPipeline } = initModule([contentSlot1.moliSlot]);

      module.init(moliConfig);

      expect(moliConfig.pipeline).to.be.ok;
      expect(moliConfig.pipeline?.prepareRequestAdsSteps).to.have.lengthOf(1);
      const step = moliConfig.pipeline!.prepareRequestAdsSteps[0];

      await step(adPipelineContext(moliConfig), [contentSlot1]);

      expect(querySelectorSpy).to.have.callCount(0);
    });

    it('should not initialize sticky-header if header is not in DOM', async () => {
      const querySelectorStub = sandbox.stub(jsDomWindow.document, 'querySelector');
      querySelectorStub.returns(null);
      const loggerSpy = sandbox.spy(noopLogger, 'warn');
      const module = createStickyHeaderAdModule(headerAdDomId, [111], true);

      const contentSlot1 = createAdSlotConfig(headerAdDomId, 'desktop');
      const { moliConfig, adPipeline } = initModule([contentSlot1.moliSlot]);

      module.init(moliConfig);

      expect(moliConfig.pipeline).to.be.ok;
      expect(moliConfig.pipeline?.prepareRequestAdsSteps).to.have.lengthOf(1);
      const step = moliConfig.pipeline!.prepareRequestAdsSteps[0];

      await step({ ...adPipelineContext(moliConfig), logger: noopLogger }, [contentSlot1]);

      expect(querySelectorStub).to.have.been.calledOnce;
      expect(loggerSpy).to.have.been.calledOnce;
      expect(loggerSpy).to.have.been.calledOnceWithExactly(
        'sticky-header-ads',
        'Could not find sticky header container with selector \'[data-ref="header-ad"]\''
      );
    });
  });
});
