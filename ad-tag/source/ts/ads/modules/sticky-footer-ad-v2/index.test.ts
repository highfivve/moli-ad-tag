import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';

import { AdPipelineContext, PrepareRequestAdsStep } from '../../adPipeline';
import { googletag } from 'ad-tag/types/googletag';
import {
  emptyConfig,
  emptyRuntimeConfig,
  newEmptyConfig,
  newGlobalAuctionContext,
  noopLogger
} from 'ad-tag/stubs/moliStubs';
import * as stickyAdModule from './footerStickyAd';
import { initAdSticky } from './footerStickyAd';

import { createGoogletagStub, googleAdSlotStub } from 'ad-tag/stubs/googletagStubs';
import { fullConsent } from 'ad-tag/stubs/consentStubs';
import { AdSlot, Device, modules, MoliConfig } from 'ad-tag/types/moliConfig';
import { MoliRuntime } from 'ad-tag/types/moliRuntime';
import { createStickyFooterAdsV2 } from 'ad-tag/ads/modules/sticky-footer-ad-v2/index';
import { IModule } from 'ad-tag/types/module';
import { createDomAndWindow } from 'ad-tag/stubs/browserEnvSetup';
import { createAssetLoaderService } from 'ad-tag/util/assetLoaderService';

// setup sinon-chai
use(sinonChai);

const sandbox = Sinon.createSandbox();
let { jsDomWindow } = createDomAndWindow();

// resolved ad unit path of the sticky footer slot. On the `gam` channel this is the only way to
// identify the out-of-page anchor slot, which never carries the domId (see ADR 0007).
const stickyAdUnitPath = '/123/sticky-footer/mobile';

const stickyAdSpy = sandbox.spy(stickyAdModule, 'initAdSticky');

const setupDomAndServices = () => {
  jsDomWindow = createDomAndWindow().jsDomWindow;
  jsDomWindow.googletag = createGoogletagStub();
};

const adPipelineContext = (config: MoliConfig): AdPipelineContext => ({
  auctionId__: 'xxxx-xxxx-xxxx-xxxx',
  requestId__: 0,
  requestAdsCalls__: 1,
  env__: 'production',
  logger__: noopLogger,
  config__: config ?? emptyConfig,
  runtimeConfig__: emptyRuntimeConfig,
  window__: jsDomWindow,
  labelConfigService__: null as any,
  tcData__: fullConsent(),
  adUnitPathVariables__: {},
  auction__: newGlobalAuctionContext(jsDomWindow),
  assetLoaderService__: createAssetLoaderService(jsDomWindow)
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
  const module = createStickyFooterAdsV2();
  module.configure__({
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
  module: IModule;
  config: MoliConfig;
} => {
  const config = newEmptyConfig(slots);
  const module = createAndConfigureModule(
    moduleConfig.stickyFooterDomIds,
    moduleConfig.disallowedAdvertiserIds,
    moduleConfig.closingButtonText
  );

  const prepareSteps = module.prepareRequestAdsSteps__();
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
          'path',
          [111],
          undefined,
          'close'
        )
      );
    });

    it('should initiate stickyFooterAd with desktop', async () => {
      const desktopSlot = createAdSlotConfig('ad-desktop-sticky', 'desktop');
      const desktopGoogleAdSlot = googleAdSlotStub('/1/ad-desktop-sticky', 'ad-desktop-sticky');
      const desktopAdSlotDefinition: MoliRuntime.SlotDefinition<any> = {
        moliSlot: desktopSlot.moliSlot,
        adSlot: desktopGoogleAdSlot,
        filterSupportedSizes: {} as any
      };

      const { prepareSteps, config } = createInitializedModule(
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
          'path',
          [111],
          undefined,
          'close'
        )
      );
    });

    it('should resolve anchorBottomChannel for the mobile-priority footer slot and pass it through', async () => {
      const desktopSlot = createAdSlotConfig('ad-desktop-sticky', 'desktop');
      const mobileSlot = createAdSlotConfig('ad-mobile-sticky', 'mobile');

      const mobileGoogleAdSlot = googleAdSlotStub('/1/ad-mobile-sticky', 'ad-mobile-sticky');
      const desktopGoogleAdSlot = googleAdSlotStub('/1/ad-desktop-sticky', 'ad-desktop-sticky');

      const { prepareSteps, config } = createInitializedModule(
        {
          stickyFooterDomIds: { desktop: 'ad-desktop-sticky', mobile: 'ad-mobile-sticky' },
          disallowedAdvertiserIds: [111]
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

      const ctx = adPipelineContext(config);
      const channelStub = sandbox.stub(ctx.auction__, 'anchorBottomChannel').returns('gam');

      await prepareSteps(ctx, [mobileAdSlotDefinition, desktopAdSlotDefinition]);

      expect(channelStub).to.have.been.calledOnceWithExactly('ad-mobile-sticky');
      expect(stickyAdSpy).to.have.been.calledOnce;
      expect(stickyAdSpy.firstCall.args[6]).to.equal('gam');
    });
  });

  describe('initialize initAdSticky function', () => {
    let errorLogSpy: Sinon.SinonSpy;

    beforeEach(() => {
      errorLogSpy = sandbox.spy(noopLogger, 'warn');
    });

    afterEach(() => {
      errorLogSpy.restore();
    });

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
    ) => void = (event: googletag.events.ISlotRenderEndedEvent, listenerSpy: Sinon.SinonSpy) => {
      const callback = listenerSpy.args.find(
        args => (args[0] as string) === 'slotRenderEnded'
      )?.[1] as unknown as (event: googletag.events.ISlotRenderEndedEvent) => void;
      callback(event);
    };

    const slotLoadedCallback: (
      event: googletag.events.ISlotOnloadEvent,
      listenerSpy: Sinon.SinonSpy
    ) => void = (event: googletag.events.ISlotOnloadEvent, listenerSpy: Sinon.SinonSpy) => {
      const callback = listenerSpy.args.find(
        args => (args[0] as string) === 'slotOnload'
      )?.[1] as unknown as (event: googletag.events.ISlotOnloadEvent) => void;
      callback(event);
    };

    const adSticky = jsDomWindow.document.createElement('div');
    adSticky.setAttribute('data-ref', 'h5v-sticky-ad');

    const closeButton = jsDomWindow.document.createElement('div');
    closeButton.setAttribute('data-ref', 'h5v-sticky-ad-close');

    it('should throw a warning if there is no adSticky container in the html', function () {
      jsDomWindow.document.querySelector('[data-ref=h5v-sticky-ad]')?.remove();
      jsDomWindow.document.body.appendChild(closeButton);
      initAdSticky(
        jsDomWindow,
        'production',
        noopLogger,
        'h5v-sticky-ad',
        stickyAdUnitPath,
        [111],
        undefined,
        'close'
      );
      expect(errorLogSpy.calledOnce).to.have.been.true;
      expect(errorLogSpy.args[0][0]).to.eq('[sticky-footer-ad]');
      expect(errorLogSpy.args[0][1]).to.eq(
        'Could not find adSticky container [data-ref=h5v-sticky-ad] or closeButton [data-ref=h5v-sticky-ad-close]'
      );
    });

    it('should throw a warning if there is no closeButton element in the html', function () {
      initAdSticky(
        jsDomWindow,
        'production',
        noopLogger,
        'h5v-sticky-ad',
        stickyAdUnitPath,
        [111],
        undefined,
        'close'
      );
      expect(errorLogSpy.calledOnce).to.have.been.true;
      expect(errorLogSpy.args[0][0]).to.eq('[sticky-footer-ad]');
      expect(errorLogSpy.args[0][1]).to.eq(
        'Could not find adSticky container [data-ref=h5v-sticky-ad] or closeButton [data-ref=h5v-sticky-ad-close]'
      );
    });

    it('should log that the stickyAd is running when adStickAd elements are available in the html', function () {
      jsDomWindow.document.body.appendChild(adSticky);
      jsDomWindow.document.body.appendChild(closeButton);

      const debugLogSpy = sandbox.spy(noopLogger, 'debug');
      initAdSticky(
        jsDomWindow,
        'production',
        noopLogger,
        'h5v-sticky-ad',
        stickyAdUnitPath,
        [111],
        undefined,
        'close'
      );
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

      initAdSticky(
        jsDomWindow,
        'production',
        noopLogger,
        'h5v-sticky-ad',
        stickyAdUnitPath,
        [111],
        undefined
      );
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

      initAdSticky(
        jsDomWindow,
        'production',
        noopLogger,
        'h5v-sticky-ad',
        stickyAdUnitPath,
        [111],
        undefined
      );
      expect(closeButton.childNodes.length).to.eq(1);
    });

    it('should hide the stickyAd if the advertiser was disallowed and id is equal to advertiser id', async function () {
      jsDomWindow.document.body.appendChild(adSticky);
      jsDomWindow.document.body.appendChild(closeButton);

      const listenerSpy = sandbox.spy(jsDomWindow.googletag.pubads(), 'addEventListener');

      await initAdSticky(
        jsDomWindow,
        'production',
        noopLogger,
        'h5v-sticky-ad',
        stickyAdUnitPath,
        [111],
        undefined,
        'close'
      );

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

    it('should hide the stickyAd if channel is gam, matching the anchor slot by adUnitPath', async function () {
      jsDomWindow.document.body.appendChild(adSticky);
      jsDomWindow.document.body.appendChild(closeButton);
      // adSticky is shared across tests, so start from a visible container - otherwise a hiding
      // class left over from a previous test would make this assertion pass trivially
      adSticky.classList.remove('h5v-footerAd--hidden');

      const listenerSpy = sandbox.spy(jsDomWindow.googletag.pubads(), 'addEventListener');

      await initAdSticky(
        jsDomWindow,
        'production',
        noopLogger,
        'h5v-sticky-ad',
        stickyAdUnitPath,
        [],
        'gam',
        'close'
      );

      // on the `gam` channel the slot is defined via `defineOutOfPageSlot`, so GPT reports its
      // own auto-generated element id - never 'h5v-sticky-ad'. Only the adUnitPath plus the
      // BOTTOM_ANCHOR format targeting identify it.
      const anchorSlot = googleAdSlotStub(stickyAdUnitPath, 'google_ads_iframe_bottom_anchor_0');
      anchorSlot.setTargeting(
        'f',
        jsDomWindow.googletag.enums.OutOfPageFormat.BOTTOM_ANCHOR.toString()
      );

      slotRenderedCallback(
        {
          slot: anchorSlot,
          advertiserId: 999,
          isEmpty: false,
          campaignId: 42
        } as googletag.events.ISlotRenderEndedEvent,
        listenerSpy
      );

      // Wait for the event loop to finish, so the adSticky can be shown or hidden.
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(adSticky.classList.contains('h5v-footerAd--hidden')).to.be.true;
    });

    it('should ignore a stale gam anchor slot when the channel is c', async function () {
      jsDomWindow.document.body.appendChild(adSticky);
      jsDomWindow.document.body.appendChild(closeButton);
      adSticky.classList.remove('h5v-footerAd--hidden');

      const listenerSpy = sandbox.spy(jsDomWindow.googletag.pubads(), 'addEventListener');

      await initAdSticky(
        jsDomWindow,
        'production',
        noopLogger,
        'h5v-sticky-ad',
        stickyAdUnitPath,
        [],
        'c',
        'close'
      );

      // a stale anchor slot from a previous cycle shares the adUnitPath and the anchor format
      // targeting. It must not be mistaken for this cycle's in-page slot, otherwise its empty
      // render would hide a legitimate prebid sticky.
      const staleAnchorSlot = googleAdSlotStub(
        stickyAdUnitPath,
        'google_ads_iframe_bottom_anchor_0'
      );
      staleAnchorSlot.setTargeting(
        'f',
        jsDomWindow.googletag.enums.OutOfPageFormat.BOTTOM_ANCHOR.toString()
      );

      slotRenderedCallback(
        {
          slot: staleAnchorSlot,
          advertiserId: 999,
          isEmpty: true,
          campaignId: 42
        } as googletag.events.ISlotRenderEndedEvent,
        listenerSpy
      );

      await new Promise(resolve => setTimeout(resolve, 0));
      expect(adSticky.classList.contains('h5v-footerAd--hidden')).to.be.false;
    });

    it('should not hide the stickyAd if channel is c and the advertiser is not disallowed', async function () {
      jsDomWindow.document.body.appendChild(adSticky);
      jsDomWindow.document.body.appendChild(closeButton);

      const listenerSpy = sandbox.spy(jsDomWindow.googletag.pubads(), 'addEventListener');

      await initAdSticky(
        jsDomWindow,
        'production',
        noopLogger,
        'h5v-sticky-ad',
        stickyAdUnitPath,
        [],
        'c',
        'close'
      );

      slotRenderedCallback(slotRenderEndedEvent, listenerSpy);
      slotLoadedCallback(slotLoadedEvent, listenerSpy);

      // Wait for the event loop to finish, so the adSticky can be shown or hidden.
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(adSticky.classList.contains('h5v-footerAd--hidden')).to.be.false;
    });

    it('should hide the stickyAd if the advertiser is disallowed and id is inside companyIds array', async function () {
      // Arrange: Add sticky ad container and close button to the DOM
      const adSticky = jsDomWindow.document.createElement('div');
      adSticky.setAttribute('data-ref', 'h5v-sticky-ad');
      jsDomWindow.document.body.appendChild(adSticky);

      const closeButton = jsDomWindow.document.createElement('div');
      closeButton.setAttribute('data-ref', 'h5v-sticky-ad-close');
      jsDomWindow.document.body.appendChild(closeButton);

      const listenerSpy = sandbox.spy(jsDomWindow.googletag.pubads(), 'addEventListener');

      await initAdSticky(
        jsDomWindow,
        'production',
        noopLogger,
        'h5v-sticky-ad',
        stickyAdUnitPath,
        [123],
        undefined,
        'close'
      );

      const slotRenderEndedEvent: googletag.events.ISlotRenderEndedEvent = {
        slot: { getSlotElementId: () => 'h5v-sticky-ad' } as googletag.IAdSlot,
        advertiserId: 456,
        companyIds: [123],
        campaignId: 42
      } as googletag.events.ISlotRenderEndedEvent;

      const slotRenderedCallback: (event: googletag.events.ISlotRenderEndedEvent) => void =
        listenerSpy.args.find(
          args => (args[0] as string) === 'slotRenderEnded'
        )?.[1] as unknown as (event: googletag.events.ISlotRenderEndedEvent) => void;

      slotRenderedCallback(slotRenderEndedEvent);
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

      await initAdSticky(
        jsDomWindow,
        'production',
        noopLogger,
        'h5v-sticky-ad',
        stickyAdUnitPath,
        [],
        undefined,
        'close'
      );

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

      await initAdSticky(
        jsDomWindow,
        'production',
        noopLogger,
        'h5v-sticky-ad',
        stickyAdUnitPath,
        [999],
        undefined,
        'close'
      );

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

      await initAdSticky(
        jsDomWindow,
        'production',
        noopLogger,
        'h5v-sticky-ad',
        stickyAdUnitPath,
        [111],
        undefined,
        'close'
      );

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
    it('should remove all hidden classes from the stickyAd container if there is an ad', async function () {
      const adSticky = jsDomWindow.document.createElement('div');
      adSticky.setAttribute('data-ref', 'h5v-sticky-ad');
      adSticky.classList.add('h5v-footerAd--hidden-m', 'h5v-footerAd--hidden-d');

      const closeButton = jsDomWindow.document.createElement('div');
      closeButton.setAttribute('data-ref', 'h5v-sticky-ad-close');

      jsDomWindow.document.body.appendChild(adSticky);
      jsDomWindow.document.body.appendChild(closeButton);

      const listenerSpy = sandbox.spy(jsDomWindow.googletag.pubads(), 'addEventListener');

      await initAdSticky(
        jsDomWindow,
        'production',
        noopLogger,
        'h5v-sticky-ad',
        stickyAdUnitPath,
        [],
        undefined,
        'close'
      );

      slotRenderedCallback(slotRenderEndedEvent, listenerSpy);
      slotLoadedCallback(slotLoadedEvent, listenerSpy);

      // Wait for the event loop to finish, so the adSticky can be shown or hidden.
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(adSticky.classList.contains('h5v-footerAd--hidden')).to.be.false;
      expect(adSticky.classList.contains('h5v-footerAd--hidden-m')).to.be.false;
      expect(adSticky.classList.contains('h5v-footerAd--hidden-d')).to.be.false;
    });
  });
});
