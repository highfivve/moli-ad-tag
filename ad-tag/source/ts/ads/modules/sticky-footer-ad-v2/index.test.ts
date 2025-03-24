import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';

import { AdPipelineContext, PrepareRequestAdsStep } from '../../adPipeline';
import { GlobalAuctionContext } from '../../globalAuctionContext';
import { googletag } from 'ad-tag/types/googletag';
import {
  emptyConfig,
  emptyRuntimeConfig,
  newEmptyConfig,
  noopLogger
} from 'ad-tag/stubs/moliStubs';
import * as stickyAdModule from './footerStickyAd';

import { createGoogletagStub, googleAdSlotStub } from 'ad-tag/stubs/googletagStubs';
import { fullConsent } from 'ad-tag/stubs/consentStubs';
import { AdSlot, Device, modules, MoliConfig } from 'ad-tag/types/moliConfig';
import { MoliRuntime } from 'ad-tag/types/moliRuntime';
import { StickyFooterAdsV2 } from 'ad-tag/ads/modules/sticky-footer-ad-v2/index';
import { createDomAndWindow } from 'ad-tag/stubs/browserEnvSetup';
import { initAdSticky } from './footerStickyAd';
import { createAssetLoaderService } from 'ad-tag/util/assetLoaderService';

// setup sinon-chai
use(sinonChai);

const sandbox = Sinon.createSandbox();
let { jsDomWindow } = createDomAndWindow();

const stickyAdSpy = sandbox.spy(stickyAdModule, 'initAdSticky');

const setupDomAndServices = () => {
  jsDomWindow = createDomAndWindow().jsDomWindow;
  jsDomWindow.googletag = createGoogletagStub();
};

const adPipelineContext = (config: MoliConfig): AdPipelineContext => ({
  auctionId: 'xxxx-xxxx-xxxx-xxxx',
  requestId: 0,
  requestAdsCalls: 1,
  env: 'production',
  logger: noopLogger,
  config: config ?? emptyConfig,
  runtimeConfig: emptyRuntimeConfig,
  window: jsDomWindow,
  labelConfigService: null as any,
  tcData: fullConsent(),
  adUnitPathVariables: {},
  auction: new GlobalAuctionContext(jsDomWindow, noopLogger),
  assetLoaderService: createAssetLoaderService(jsDomWindow)
});

const createAdSlotConfig = (domId: string, device: Device): MoliRuntime.SlotDefinition => {
  const adSlot: AdSlot = {
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

  return {
    moliSlot: adSlot,
    adSlot: {
      getSlotElementId: () => adSlot.domId
    } as googletag.IAdSlot,
    filterSupportedSizes: () => []
  };
};

const createAndConfigureModule = (
  stickyFooterDomIds: modules.stickyFooterAdV2.FooterDomIds = {},
  disallowedAdvertiserIds: number[] = [],
  closingButtonText?: string
) => {
  const module = new StickyFooterAdsV2();
  module.configure({
    stickyFooterAdV2: {
      enabled: true,
      stickyFooterDomIds,
      disallowedAdvertiserIds,
      closingButtonText
    }
  });
  return module;
};

const createInitializedModule = (
  moduleConfig: {
    stickyFooterDomIds: modules.stickyFooterAdV2.FooterDomIds;
    disallowedAdvertiserIds: number[];
    closingButtonText?: string;
  },
  slots: AdSlot[] = []
): {
  prepareSteps: PrepareRequestAdsStep;
  module: StickyFooterAdsV2;
  config: MoliConfig;
} => {
  const config = newEmptyConfig(slots);
  const module = createAndConfigureModule(
    moduleConfig.stickyFooterDomIds,
    moduleConfig.disallowedAdvertiserIds,
    moduleConfig.closingButtonText
  );

  const prepareSteps = module.prepareRequestAdsSteps();
  expect(prepareSteps).to.be.ok;
  expect(prepareSteps).to.have.lengthOf(1);

  return { prepareSteps: prepareSteps[0], module, config };
};

beforeEach(() => {
  setupDomAndServices();
});

afterEach(() => {
  sandbox.reset();
  sandbox.resetHistory();
});

describe('Sticky-footer-v2 Module', () => {
  describe('Initialize sticky-footer-v2', () => {
    it('should add an init step', async () => {
      const { prepareSteps } = createInitializedModule({
        stickyFooterDomIds: { desktop: 'ad-desktop-sticky', mobile: 'ad-mobile-sticky' },
        disallowedAdvertiserIds: []
      });

      expect(prepareSteps.name).to.be.eq('sticky-footer-ads-v2');
    });

    it('should initiate stickyFooterAd only with mobile slot if the two devices were found', async () => {
      const desktopSlot = createAdSlotConfig('ad-desktop-sticky', 'desktop');
      const mobileSlot = createAdSlotConfig('ad-mobile-sticky', 'mobile');

      const mobileGoogleAdSlot = googleAdSlotStub('/1/ad-mobile-sticky', 'ad-mobile-sticky');
      const desktopGoogleAdSlot = googleAdSlotStub('/1/ad-desktop-sticky', 'ad-desktop-sticky');

      const { prepareSteps, config } = createInitializedModule(
        {
          stickyFooterDomIds: { desktop: 'ad-desktop-sticky', mobile: 'ad-mobile-sticky' },
          disallowedAdvertiserIds: [111],
          closingButtonText: 'close'
        },
        [desktopSlot.moliSlot, mobileSlot.moliSlot]
      );

      const mobileAdSlotDefinition: MoliRuntime.SlotDefinition<any> = {
        moliSlot: mobileSlot.moliSlot,
        adSlot: mobileGoogleAdSlot,
        filterSupportedSizes: {} as any
      };
      const desktopAdSlotDefinition: MoliRuntime.SlotDefinition<any> = {
        moliSlot: desktopSlot.moliSlot,
        adSlot: desktopGoogleAdSlot,
        filterSupportedSizes: {} as any
      };

      await prepareSteps(adPipelineContext(config), [
        mobileAdSlotDefinition,
        desktopAdSlotDefinition
      ]);

      expect(stickyAdSpy).to.have.been.calledOnce;
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
      const desktopSlot = createAdSlotConfig('ad-desktop-sticky', 'desktop');
      const desktopGoogleAdSlot = googleAdSlotStub('/1/ad-desktop-sticky', 'ad-desktop-sticky');
      const desktopAdSlotDefinition: MoliRuntime.SlotDefinition<any> = {
        moliSlot: desktopSlot,
        adSlot: desktopGoogleAdSlot,
        filterSupportedSizes: {} as any
      };

      const { prepareSteps, config, module } = createInitializedModule(
        {
          stickyFooterDomIds: { desktop: 'ad-desktop-sticky' },
          disallowedAdvertiserIds: [111]
        },
        [desktopSlot.moliSlot]
      );

      await prepareSteps(adPipelineContext(config), [desktopAdSlotDefinition]);

      expect(stickyAdSpy).to.have.been.calledOnce;
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

    const slotRenderEndedEvent: googletag.events.ISlotRenderEndedEvent = {
      slot: { getSlotElementId: () => 'h5v-sticky-ad' } as googletag.IAdSlot,
      advertiserId: 111,
      campaignId: 42
    } as googletag.events.ISlotRenderEndedEvent;

    const slotLoadedEvent: googletag.events.ISlotOnloadEvent = {
      slot: { getSlotElementId: () => 'h5v-sticky-ad' } as googletag.IAdSlot,
      serviceName: 'gpt'
    } as googletag.events.ISlotOnloadEvent;

    const slotRenderedCallback: (
      event: googletag.events.ISlotRenderEndedEvent,
      listenerSpy: Sinon.SinonSpy
    ) => void = (event: googletag.events.ISlotRenderEndedEvent, listenerSpy: Sinon.SinonSpy) =>
      listenerSpy.args.find(args => (args[0] as string) === 'slotRenderEnded')?.[1] as unknown as (
        event: googletag.events.ISlotRenderEndedEvent
      ) => void;

    const slotLoadedCallback: (
      event: googletag.events.ISlotOnloadEvent,
      listenerSpy: Sinon.SinonSpy
    ) => void = (event: googletag.events.ISlotOnloadEvent, listenerSpy: Sinon.SinonSpy) =>
      listenerSpy.args.find(args => (args[0] as string) === 'slotOnload')?.[1] as unknown as (
        event: googletag.events.ISlotOnloadEvent
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

    it('should not add the X svg to the closing button if it already exists', function () {
      const closeButton = jsDomWindow.document.createElement('div');
      closeButton.setAttribute('data-ref', 'h5v-sticky-ad-close');
      const closeButtonSvg = jsDomWindow.document.createElementNS(
        'http://www.w3.org/2000/svg',
        'svg'
      );
      closeButton.appendChild(closeButtonSvg);
      jsDomWindow.document.body.appendChild(adSticky);
      jsDomWindow.document.body.appendChild(closeButton);

      initAdSticky(jsDomWindow, 'production', noopLogger, 'h5v-sticky-ad', [111]);
      expect(closeButton.childNodes.length).to.eq(1);
    });

    it('should hide the stickyAd if the advertiser was disallowed', async function () {
      jsDomWindow.document.body.appendChild(adSticky);
      jsDomWindow.document.body.appendChild(closeButton);

      const listenerSpy = sandbox.spy(jsDomWindow.googletag.pubads(), 'addEventListener');

      await initAdSticky(jsDomWindow, 'production', noopLogger, 'h5v-sticky-ad', [111], 'close');

      const slotRenderEndedEvent: googletag.events.ISlotRenderEndedEvent = {
        slot: { getSlotElementId: () => 'h5v-sticky-ad' } as googletag.IAdSlot,
        advertiserId: 111,
        campaignId: 42
      } as googletag.events.ISlotRenderEndedEvent;

      const slotLoadedEvent: googletag.events.ISlotOnloadEvent = {
        slot: { getSlotElementId: () => 'h5v-sticky-ad' } as googletag.IAdSlot,
        serviceName: 'gpt'
      } as googletag.events.ISlotOnloadEvent;

      const slotRenderedCallback: (event: googletag.events.ISlotRenderEndedEvent) => void =
        listenerSpy.args.find(
          args => (args[0] as string) === 'slotRenderEnded'
        )?.[1] as unknown as (event: googletag.events.ISlotRenderEndedEvent) => void;

      const slotLoadedCallback: (event: googletag.events.ISlotOnloadEvent) => void =
        listenerSpy.args.find(args => (args[0] as string) === 'slotOnload')?.[1] as unknown as (
          event: googletag.events.ISlotOnloadEvent
        ) => void;

      slotRenderedCallback(slotRenderEndedEvent);
      slotLoadedCallback(slotLoadedEvent);

      // Wait for the event loop to finish, so the adSticky can be shown or hidden.
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(adSticky.classList.contains('h5v-footerAd--hidden')).to.be.true;
    });

    it('should hide the stickyAd after clicking the close button', async function () {
      const adSticky = jsDomWindow.document.createElement('div');
      adSticky.setAttribute('data-ref', 'h5v-sticky-ad');

      const closeButton = jsDomWindow.document.createElement('div');
      closeButton.setAttribute('data-ref', 'h5v-sticky-ad-close');

      jsDomWindow.document.body.appendChild(adSticky);
      jsDomWindow.document.body.appendChild(closeButton);

      const listenerSpy = sandbox.spy(jsDomWindow.googletag.pubads(), 'addEventListener');

      await initAdSticky(jsDomWindow, 'production', noopLogger, 'h5v-sticky-ad', [111], 'close');

      slotRenderedCallback(slotRenderEndedEvent, listenerSpy);
      slotLoadedCallback(slotLoadedEvent, listenerSpy);

      // Wait for the event loop to finish, so the adSticky can be shown or hidden.
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(adSticky.classList.contains('h5v-footerAd--hidden')).to.be.false;
      closeButton.click();
      expect(adSticky.classList.contains('h5v-footerAd--hidden')).to.be.true;
    });

    it('should show the stickyAd only if there was an ad', async function () {
      const adSticky = jsDomWindow.document.createElement('div');
      adSticky.setAttribute('data-ref', 'h5v-sticky-ad');

      const closeButton = jsDomWindow.document.createElement('div');
      closeButton.setAttribute('data-ref', 'h5v-sticky-ad-close');

      jsDomWindow.document.body.appendChild(adSticky);
      jsDomWindow.document.body.appendChild(closeButton);

      const listenerSpy = sandbox.spy(jsDomWindow.googletag.pubads(), 'addEventListener');

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

      const listenerSpy = sandbox.spy(jsDomWindow.googletag.pubads(), 'addEventListener');

      await initAdSticky(jsDomWindow, 'production', noopLogger, 'h5v-sticky-ad', [111], 'close');

      const emptySlotRenderEndedEvent: googletag.events.ISlotRenderEndedEvent = {
        slot: { getSlotElementId: () => 'h5v-sticky-ad' } as googletag.IAdSlot,
        advertiserId: 999,
        campaignId: 42,
        isEmpty: true
      } as googletag.events.ISlotRenderEndedEvent;

      const slotRenderedCallback: (event: googletag.events.ISlotRenderEndedEvent) => void =
        listenerSpy.args.find(
          args => (args[0] as string) === 'slotRenderEnded'
        )?.[1] as unknown as (event: googletag.events.ISlotRenderEndedEvent) => void;

      slotRenderedCallback(emptySlotRenderEndedEvent);

      // Wait for the event loop to finish, so the adSticky can be shown or hidden.
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(adSticky.classList.contains('h5v-footerAd--hidden')).to.be.true;
    });
  });
});
