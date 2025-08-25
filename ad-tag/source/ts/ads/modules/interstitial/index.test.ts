import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';

import { PrepareRequestAdsStep } from '../../adPipeline';
import { googletag } from 'ad-tag/types/googletag';
import { newEmptyConfig, noopLogger } from 'ad-tag/stubs/moliStubs';
import { initInterstitialModule } from './interstitialAd';

import { createGoogletagStub } from 'ad-tag/stubs/googletagStubs';
import { AdSlot, MoliConfig } from 'ad-tag/types/moliConfig';
import { createDomAndWindow } from 'ad-tag/stubs/browserEnvSetup';
import { InterstitialModule } from 'ad-tag/ads/modules/interstitial/index';

// setup sinon-chai
use(sinonChai);

const sandbox = Sinon.createSandbox();
let { jsDomWindow } = createDomAndWindow();

const setupDomAndServices = () => {
  jsDomWindow = createDomAndWindow().jsDomWindow;
  jsDomWindow.googletag = createGoogletagStub();
};

const createAndConfigureModule = (
  interstitialDomId: string,
  disallowedAdvertiserIds: number[] = []
) => {
  const module = new InterstitialModule();
  module.configure__({
    interstitial: {
      enabled: true,
      interstitialDomId,
      disallowedAdvertiserIds
    }
  });
  return module;
};

const createInitializedModule = (
  moduleConfig: {
    interstitialDomId: string;
    disallowedAdvertiserIds: number[];
  },
  slots: AdSlot[] = []
): {
  prepareSteps: PrepareRequestAdsStep;
  module: InterstitialModule;
  config: MoliConfig;
} => {
  const config = newEmptyConfig(slots);
  const module = createAndConfigureModule(
    moduleConfig.interstitialDomId,
    moduleConfig.disallowedAdvertiserIds
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

describe('Interstitial module', () => {
  describe('Initialize interstitial module', () => {
    it('should add an init step', async () => {
      const { prepareSteps } = createInitializedModule({
        interstitialDomId: 'interstitial',
        disallowedAdvertiserIds: []
      });

      expect(prepareSteps.name).to.be.eq('interstitial-module');
    });

    describe('initialize initAdSticky function', () => {
      const errorLogSpy = sandbox.spy(noopLogger, 'warn');

      const slotRenderEndedEvent: googletag.events.ISlotRenderEndedEvent = {
        slot: { getSlotElementId: () => 'interstitial' } as googletag.IAdSlot,
        advertiserId: 111,
        campaignId: 42
      } as googletag.events.ISlotRenderEndedEvent;

      const slotLoadedEvent: googletag.events.ISlotOnloadEvent = {
        slot: { getSlotElementId: () => 'interstitial' } as googletag.IAdSlot,
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

      const interstitialContainerClass = 'h5v-interstitial--container';
      const closeButtonClass = 'h5v-interstitial--close';

      const interstitialAd = jsDomWindow.document.createElement('div');
      interstitialAd.classList.add(interstitialContainerClass);

      const closeButton = jsDomWindow.document.createElement('button');
      closeButton.classList.add(closeButtonClass);

      it('should throw a warning if there is no interstitial container in the html', function () {
        jsDomWindow.document.querySelector(`.${interstitialContainerClass}`)?.remove();
        jsDomWindow.document.body.appendChild(closeButton);
        initInterstitialModule(jsDomWindow, 'production', noopLogger, 'interstitial', [111]);
        expect(errorLogSpy.calledOnce).to.have.been.true;
        expect(errorLogSpy.args[0][0]).to.eq('[interstitial-module]');
        expect(errorLogSpy.args[0][1]).to.eq(
          `Could not find interstitial container .${interstitialContainerClass} or closeButton .${closeButtonClass}`
        );
      });

      it('should log that the interstitial module is running when interstitial elements are available in the html', function () {
        jsDomWindow.document.body.appendChild(interstitialAd);
        jsDomWindow.document.body.appendChild(closeButton);

        const debugLogSpy = sandbox.spy(noopLogger, 'debug');
        initInterstitialModule(jsDomWindow, 'production', noopLogger, 'interstitial', [111]);
        expect(debugLogSpy.calledOnce).to.have.been.true;
        expect(debugLogSpy.args.length).to.eq(1);
        expect(debugLogSpy.args[0][0]).to.eq('interstitial-module');
        expect(debugLogSpy.args[0][1]).to.eq(
          'Running interstitial module with defined container and close button'
        );
      });

      it('should hide the interstitial if the advertiser was disallowed', async function () {
        jsDomWindow.document.body.appendChild(interstitialAd);
        jsDomWindow.document.body.appendChild(closeButton);

        const listenerSpy = sandbox.spy(jsDomWindow.googletag.pubads(), 'addEventListener');

        await initInterstitialModule(jsDomWindow, 'production', noopLogger, 'interstitial', [111]);

        const slotRenderEndedEvent: googletag.events.ISlotRenderEndedEvent = {
          slot: { getSlotElementId: () => 'interstitial' } as googletag.IAdSlot,
          advertiserId: 111,
          campaignId: 42
        } as googletag.events.ISlotRenderEndedEvent;

        const slotLoadedEvent: googletag.events.ISlotOnloadEvent = {
          slot: { getSlotElementId: () => 'interstitial' } as googletag.IAdSlot,
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
        expect(interstitialAd.classList.contains('h5v-interstitial--hidden')).to.be.true;
      });

      it('should hide the interstitial after clicking the close button', async function () {
        jsDomWindow.document.body.appendChild(interstitialAd);
        jsDomWindow.document.body.appendChild(closeButton);

        const listenerSpy = sandbox.spy(jsDomWindow.googletag.pubads(), 'addEventListener');

        await initInterstitialModule(jsDomWindow, 'production', noopLogger, 'interstitial', []);

        slotRenderedCallback(slotRenderEndedEvent, listenerSpy);
        slotLoadedCallback(slotLoadedEvent, listenerSpy);

        // Wait for the event loop to finish, so the adSticky can be shown or hidden.
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(interstitialAd.classList.contains('h5v-interstitial--hidden')).to.be.false;
        closeButton.click();
        expect(interstitialAd.classList.contains('h5v-interstitial--hidden')).to.be.true;
      });

      it('should show the interstitial only if there was an ad', async function () {
        jsDomWindow.document.body.appendChild(interstitialAd);
        jsDomWindow.document.body.appendChild(closeButton);

        const listenerSpy = sandbox.spy(jsDomWindow.googletag.pubads(), 'addEventListener');

        await initInterstitialModule(jsDomWindow, 'production', noopLogger, 'interstitial', [999]);

        slotRenderedCallback(slotRenderEndedEvent, listenerSpy);
        slotLoadedCallback(slotLoadedEvent, listenerSpy);

        // Wait for the event loop to finish, so the adSticky can be shown or hidden.
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(interstitialAd.classList.contains('h5v-interstitial--hidden')).to.be.false;
      });

      it('should hide the stickyAd if the slotRenderEndedEvent was empty', async function () {
        jsDomWindow.document.body.appendChild(interstitialAd);
        jsDomWindow.document.body.appendChild(closeButton);

        const listenerSpy = sandbox.spy(jsDomWindow.googletag.pubads(), 'addEventListener');

        await initInterstitialModule(jsDomWindow, 'production', noopLogger, 'interstitial', [111]);

        const emptySlotRenderEndedEvent: googletag.events.ISlotRenderEndedEvent = {
          slot: { getSlotElementId: () => 'interstitial' } as googletag.IAdSlot,
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
        expect(interstitialAd.classList.contains('h5v-interstitial--hidden')).to.be.true;
      });
      it('should remove all hidden classes from the interstitial container if there is an ad', async function () {
        jsDomWindow.document.body.appendChild(interstitialAd);
        jsDomWindow.document.body.appendChild(closeButton);

        const listenerSpy = sandbox.spy(jsDomWindow.googletag.pubads(), 'addEventListener');

        await initInterstitialModule(jsDomWindow, 'production', noopLogger, 'interstitial', []);

        slotRenderedCallback(slotRenderEndedEvent, listenerSpy);
        slotLoadedCallback(slotLoadedEvent, listenerSpy);

        // Wait for the event loop to finish, so the adSticky can be shown or hidden.
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(interstitialAd.classList.contains('h5v-interstitial--hidden')).to.be.false;
      });
    });
  });
});
