import { expect } from 'chai';
import * as Sinon from 'sinon';

import { createDom } from '@highfivve/ad-tag/lib/stubs/browserEnvSetup';
import { createGoogletagStub, googleAdSlotStub } from '@highfivve/ad-tag/lib/stubs/googletagStubs';
import { dummySchainConfig } from '@highfivve/ad-tag/lib/stubs/schainStubs';
import { reportingServiceStub } from '@highfivve/ad-tag/lib/stubs/reportingServiceStub';
import { noopLogger } from '@highfivve/ad-tag/lib/stubs/moliStubs';
import {
  googletag,
  prebidjs,
  Moli,
  AdPipeline,
  AdPipelineContext,
  IAdPipelineConfiguration,
  createAssetLoaderService
} from '@highfivve/ad-tag';

import Device = Moli.Device;
import { FooterDomIds, StickyFooterAdsV2 } from './index';
import * as stickyAdModule from './footerStickyAd';

const sandbox = Sinon.createSandbox();
let dom = createDom();
let jsDomWindow: Window & googletag.IGoogleTagWindow & prebidjs.IPrebidjsWindow = dom.window as any;

const assetLoaderService = createAssetLoaderService(jsDomWindow);
const reportingService = reportingServiceStub();
const stickyAdSpy = Sinon.spy(stickyAdModule, 'initAdSticky');

const emptyPipelineConfig: IAdPipelineConfiguration = {
  init: [],
  configure: [],
  defineSlots: () => Promise.resolve([]),
  prepareRequestAds: [],
  requestBids: [],
  requestAds: () => Promise.resolve()
};
const adPipelineContext = (config: Moli.MoliConfig): AdPipelineContext => {
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
    adUnitPathVariables: {}
  };
};

const createAdSlotConfig = (domId: string, device: Device) => {
  const slot: Moli.AdSlot = {
    domId: domId,
    adUnitPath: 'path',
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
  return slot;
};

const createStickyFooterAdModule = (
  stickyFooterDomIds: FooterDomIds = {},
  disallowedAdvertiserIds: number[] = [],
  closingButtonText?: string
): StickyFooterAdsV2 => {
  return new StickyFooterAdsV2({
    stickyFooterDomIds,
    disallowedAdvertiserIds,
    closingButtonText
  });
};

const initModule = (
  module: StickyFooterAdsV2,
  configPipeline?: Moli.pipeline.PipelineConfig,
  moliSlot?: Moli.AdSlot[]
) => {
  const moliConfig: Moli.MoliConfig = {
    slots: moliSlot ? [...moliSlot] : [{ domId: 'foo' } as Moli.AdSlot],
    pipeline: configPipeline,
    logger: noopLogger,
    schain: dummySchainConfig
  };

  const adPipeline = new AdPipeline(emptyPipelineConfig, noopLogger, jsDomWindow, reportingService);

  return { moliConfig, adPipeline };
};

beforeEach(() => {
  jsDomWindow.googletag = createGoogletagStub();
});

afterEach(() => {
  dom = createDom();
  jsDomWindow = dom.window as any;
  sandbox.reset();
  sandbox.restore();
});
describe('initialize', () => {
  it('should add an init step', async () => {
    const module = createStickyFooterAdModule({
      desktop: 'ad-desktop-sticky',
      mobile: 'ad-mobile-sticky'
    });

    const desktopSlot = createAdSlotConfig('ad-desktop-sticky', 'desktop');
    const { moliConfig, adPipeline } = initModule(module, undefined, [desktopSlot]);

    module.init(moliConfig, assetLoaderService, () => adPipeline);

    expect(moliConfig.pipeline).to.be.ok;
    expect(moliConfig.pipeline?.prepareRequestAdsSteps).to.have.lengthOf(1);
    expect(moliConfig.pipeline?.prepareRequestAdsSteps[0].name).to.be.eq('sticky-footer-ads-v2');
  });

  it('should initiate stickyFooterAd only with mobile slot if the two devices were found', async () => {
    const module = createStickyFooterAdModule(
      {
        desktop: 'ad-desktop-sticky',
        mobile: 'ad-mobile-sticky'
      },
      [111],
      'close'
    );

    const desktopSlot = createAdSlotConfig('ad-desktop-sticky', 'desktop');
    const mobileSlot = createAdSlotConfig('ad-mobile-sticky', 'mobile');

    const { moliConfig, adPipeline } = initModule(module, undefined, [desktopSlot, mobileSlot]);

    module.init(moliConfig, assetLoaderService, () => adPipeline);

    const mobileGoogleAdSlot = googleAdSlotStub('/1/ad-mobile-sticky', 'ad-mobile-sticky');
    const desktopGoogleAdSlot = googleAdSlotStub('/1/ad-desktop-sticky', 'ad-desktop-sticky');

    const mobileAdSlotDefinition: Moli.SlotDefinition<any> = {
      moliSlot: mobileSlot,
      adSlot: mobileGoogleAdSlot,
      filterSupportedSizes: {} as any
    };
    const desktopAdSlotDefinition: Moli.SlotDefinition<any> = {
      moliSlot: desktopSlot,
      adSlot: desktopGoogleAdSlot,
      filterSupportedSizes: {} as any
    };
    const initStickyAd = moliConfig.pipeline?.prepareRequestAdsSteps[0];
    await initStickyAd!(adPipelineContext(moliConfig), [
      mobileAdSlotDefinition,
      desktopAdSlotDefinition
    ]);

    expect(stickyAdSpy.calledOnce).to.be.true;

    expect(
      stickyAdSpy.calledWithExactly(
        jsDomWindow,
        'production',
        noopLogger,
        'ad-mobile-sticky',
        [111],
        'close'
      )
    );
  });

  it('should initiate stickyFooterAd with desktop', async () => {
    const module = createStickyFooterAdModule(
      {
        desktop: 'ad-desktop-sticky'
      },
      [111]
    );

    const desktopSlot = createAdSlotConfig('ad-desktop-sticky', 'desktop');

    const { moliConfig, adPipeline } = initModule(module, undefined, [desktopSlot]);

    module.init(moliConfig, assetLoaderService, () => adPipeline);

    const desktopGoogleAdSlot = googleAdSlotStub('/1/ad-desktop-sticky', 'ad-desktop-sticky');

    const desktopAdSlotDefinition: Moli.SlotDefinition<any> = {
      moliSlot: desktopSlot,
      adSlot: desktopGoogleAdSlot,
      filterSupportedSizes: {} as any
    };
    const initStickyAd = moliConfig.pipeline?.prepareRequestAdsSteps[0];
    await initStickyAd!(adPipelineContext(moliConfig), [desktopAdSlotDefinition]);

    expect(
      stickyAdSpy.calledOnceWithExactly(
        jsDomWindow,
        'production',
        noopLogger,
        'ad-desktop-sticky',
        [111],
        'close'
      )
    );
  });
});
