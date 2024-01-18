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
import { initAdSticky } from './footerStickyAd';
import ISlotRenderEndedEvent = googletag.events.ISlotRenderEndedEvent;
import ISlotOnloadEvent = googletag.events.ISlotOnloadEvent;

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
  sandbox.resetHistory();
});

describe('Sticky-footer-v2 Module', () => {
  describe('Initialize sticky-footer-v2', () => {
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

  describe('initialize initAdSticky function', () => {
    const errorLogSpy = sandbox.spy(noopLogger, 'warn');

    const slotRenderEndedEvent: ISlotRenderEndedEvent = {
      slot: { getSlotElementId: () => 'h5v-sticky-ad' } as googletag.IAdSlot,
      advertiserId: 111,
      campaignId: 42
    } as ISlotRenderEndedEvent;

    const slotLoadedEvent: ISlotOnloadEvent = {
      slot: { getSlotElementId: () => 'h5v-sticky-ad' } as googletag.IAdSlot,
      serviceName: 'gpt'
    } as ISlotOnloadEvent;

    const slotRenderedCallback: (
      event: ISlotRenderEndedEvent,
      listenerSpy: Sinon.SinonSpy
    ) => void = (event: ISlotRenderEndedEvent, listenerSpy: Sinon.SinonSpy) =>
      listenerSpy.args.find(args => (args[0] as string) === 'slotRenderEnded')?.[1] as unknown as (
        event: ISlotRenderEndedEvent
      ) => void;

    const slotLoadedCallback: (event: ISlotOnloadEvent, listenerSpy: Sinon.SinonSpy) => void = (
      event: ISlotOnloadEvent,
      listenerSpy: Sinon.SinonSpy
    ) =>
      listenerSpy.args.find(args => (args[0] as string) === 'slotOnload')?.[1] as unknown as (
        event: ISlotOnloadEvent
      ) => void;

    const adSticky = jsDomWindow.document.createElement('div');
    adSticky.setAttribute('data-ref', 'h5v-sticky-ad');

    const closeButton = jsDomWindow.document.createElement('div');
    closeButton.setAttribute('data-ref', 'h5v-sticky-ad-close');

    it('should throw a warning if there is no adSticky container in the html', function () {
      jsDomWindow.document.querySelector('[data-ref=h5v-sticky-ad]')?.remove();

      jsDomWindow.document.body.appendChild(closeButton);
      initAdSticky(jsDomWindow, 'production', noopLogger, 'h5v-sticky-ad', [111], 'close');
      expect(errorLogSpy.calledOnce).to.have.been.true;
      expect(errorLogSpy.args[0][0]).to.eq('[sticky-footer-ad]');
      expect(errorLogSpy.args[0][1]).to.eq(
        'Could not find adSticky container [data-ref=h5v-sticky-ad] or closeButton [data-ref=h5v-sticky-ad-close]'
      );
    });

    it('should throw a warning if there is no closeButton element in the html', function () {
      initAdSticky(jsDomWindow, 'production', noopLogger, 'h5v-sticky-ad', [111], 'close');
      expect(errorLogSpy.calledOnce).to.have.been.true;
      expect(errorLogSpy.args[0][0]).to.eq('[sticky-footer-ad]');
      expect(errorLogSpy.args[0][1]).to.eq(
        'Could not find adSticky container [data-ref=h5v-sticky-ad] or closeButton [data-ref=h5v-sticky-ad-close]'
      );
    });

    it('should log that the stickAd is running when adStickAd elements are available in the html', function () {
      jsDomWindow.document.body.appendChild(adSticky);
      jsDomWindow.document.body.appendChild(closeButton);

      const debugLogSpy = sandbox.spy(noopLogger, 'debug');
      initAdSticky(jsDomWindow, 'production', noopLogger, 'h5v-sticky-ad', [111], 'close');
      expect(debugLogSpy.calledOnce).to.have.been.true;
      expect(debugLogSpy.args.length).to.eq(1);
      expect(debugLogSpy.args[0][0]).to.eq('sticky-ad');
      expect(debugLogSpy.args[0][1]).to.eq(
        'Running initAdSticky with defined sticky container and close button'
      );
    });

    it('should add an X svg to the close button if it has no custom text', function () {
      const closeButton = jsDomWindow.document.createElement('div');
      closeButton.setAttribute('data-ref', 'h5v-sticky-ad-close');
      jsDomWindow.document.body.appendChild(adSticky);
      jsDomWindow.document.body.appendChild(closeButton);

      initAdSticky(jsDomWindow, 'production', noopLogger, 'h5v-sticky-ad', [111]);
      expect(closeButton.childNodes.length).to.eq(1);
      expect(closeButton.childNodes[0].nodeName).to.eq('svg');
    });

    it('should hide the stickAd if the advertiser was disallowed', async function () {
      jsDomWindow.document.body.appendChild(adSticky);
      jsDomWindow.document.body.appendChild(closeButton);

      const listenerSpy = sandbox.spy(dom.window.googletag.pubads(), 'addEventListener');

      await initAdSticky(jsDomWindow, 'production', noopLogger, 'h5v-sticky-ad', [111], 'close');

      const slotRenderEndedEvent: ISlotRenderEndedEvent = {
        slot: { getSlotElementId: () => 'h5v-sticky-ad' } as googletag.IAdSlot,
        advertiserId: 111,
        campaignId: 42
      } as ISlotRenderEndedEvent;

      const slotLoadedEvent: ISlotOnloadEvent = {
        slot: { getSlotElementId: () => 'h5v-sticky-ad' } as googletag.IAdSlot,
        serviceName: 'gpt'
      } as ISlotOnloadEvent;

      const slotRenderedCallback: (event: ISlotRenderEndedEvent) => void = listenerSpy.args.find(
        args => (args[0] as string) === 'slotRenderEnded'
      )?.[1] as unknown as (event: ISlotRenderEndedEvent) => void;

      const slotLoadedCallback: (event: ISlotOnloadEvent) => void = listenerSpy.args.find(
        args => (args[0] as string) === 'slotOnload'
      )?.[1] as unknown as (event: ISlotOnloadEvent) => void;

      slotRenderedCallback(slotRenderEndedEvent);
      slotLoadedCallback(slotLoadedEvent);

      // Wait for the event loop to finish, so the adSticky can be shown or hidden.
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(adSticky.classList.contains('h5v-footerAd--hidden')).to.be.true;
    });

    it('should hide the stickAd after clicking the close button', async function () {
      const adSticky = jsDomWindow.document.createElement('div');
      adSticky.setAttribute('data-ref', 'h5v-sticky-ad');

      const closeButton = jsDomWindow.document.createElement('div');
      closeButton.setAttribute('data-ref', 'h5v-sticky-ad-close');

      jsDomWindow.document.body.appendChild(adSticky);
      jsDomWindow.document.body.appendChild(closeButton);

      const listenerSpy = sandbox.spy(dom.window.googletag.pubads(), 'addEventListener');

      await initAdSticky(jsDomWindow, 'production', noopLogger, 'h5v-sticky-ad', [111], 'close');

      slotRenderedCallback(slotRenderEndedEvent, listenerSpy);
      slotLoadedCallback(slotLoadedEvent, listenerSpy);

      // Wait for the event loop to finish, so the adSticky can be shown or hidden.
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(adSticky.classList.contains('h5v-footerAd--hidden')).to.be.false;
      closeButton.click();
      expect(adSticky.classList.contains('h5v-footerAd--hidden')).to.be.true;
    });

    it('should show the stickAd only if there was an ad', async function () {
      const adSticky = jsDomWindow.document.createElement('div');
      adSticky.setAttribute('data-ref', 'h5v-sticky-ad');

      const closeButton = jsDomWindow.document.createElement('div');
      closeButton.setAttribute('data-ref', 'h5v-sticky-ad-close');

      jsDomWindow.document.body.appendChild(adSticky);
      jsDomWindow.document.body.appendChild(closeButton);

      const listenerSpy = sandbox.spy(dom.window.googletag.pubads(), 'addEventListener');

      await initAdSticky(jsDomWindow, 'production', noopLogger, 'h5v-sticky-ad', [999], 'close');

      slotRenderedCallback(slotRenderEndedEvent, listenerSpy);
      slotLoadedCallback(slotLoadedEvent, listenerSpy);

      // Wait for the event loop to finish, so the adSticky can be shown or hidden.
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(adSticky.classList.contains('h5v-footerAd--hidden')).to.be.false;
    });

    it('should hide the stickyAd if the slotRenderEndedEvent was empty', async function () {
      jsDomWindow.document.body.appendChild(adSticky);
      jsDomWindow.document.body.appendChild(closeButton);

      const listenerSpy = sandbox.spy(dom.window.googletag.pubads(), 'addEventListener');

      await initAdSticky(jsDomWindow, 'production', noopLogger, 'h5v-sticky-ad', [111], 'close');

      const emptySlotRenderEndedEvent: ISlotRenderEndedEvent = {
        slot: { getSlotElementId: () => 'h5v-sticky-ad' } as googletag.IAdSlot,
        advertiserId: 999,
        campaignId: 42,
        isEmpty: true
      } as ISlotRenderEndedEvent;

      const slotRenderedCallback: (event: ISlotRenderEndedEvent) => void = listenerSpy.args.find(
        args => (args[0] as string) === 'slotRenderEnded'
      )?.[1] as unknown as (event: ISlotRenderEndedEvent) => void;

      slotRenderedCallback(emptySlotRenderEndedEvent);

      // Wait for the event loop to finish, so the adSticky can be shown or hidden.
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(adSticky.classList.contains('h5v-footerAd--hidden')).to.be.true;
    });
  });
});
