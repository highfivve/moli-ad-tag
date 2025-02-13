import { createDomAndWindow } from 'ad-tag//stubs/browserEnvSetup';
import { emptyConfig } from 'ad-tag//stubs/moliStubs';
import { createGoogletagStub, googleAdSlotStub } from 'ad-tag//stubs/googletagStubs';
import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';
import {
  bridgeInitStep,
  BridgeProtocol,
  PassbackMessage,
  RefreshAdUnitMessage
} from 'ad-tag/ads/bridge/bridge';
import { adPipelineContext } from 'ad-tag/stubs/adPipelineContextStubs';
import { AdSlot, MoliConfig } from 'ad-tag/types/moliConfig';
import { afterEach } from 'mocha';
import { createMoliTag } from 'ad-tag/ads/moli';

// setup sinon-chai
use(sinonChai);

describe('bridge', () => {
  const sandbox = Sinon.createSandbox();

  // create a fresh DOM for each test
  let { jsDomWindow } = createDomAndWindow();
  let gpt = createGoogletagStub();
  let pubads = gpt.pubads();
  jsDomWindow.googletag = gpt;

  let moli = createMoliTag(jsDomWindow);
  jsDomWindow.moli = moli;

  let pubadsRefreshSpy = sandbox.spy(pubads, 'refresh');
  let pubadsGetSlotsStub = sandbox.stub(pubads, 'getSlots');
  let addEventListenerSpy = sandbox.spy(jsDomWindow, 'addEventListener');
  let googleAdSlotDestroySlotsSpy = sandbox.spy(gpt, 'destroySlots');

  let moliRefreshAdSlotSpy = sandbox.spy(moli, 'refreshAdSlot');

  let step = bridgeInitStep();
  const configWithBridge = (slots: AdSlot[]): MoliConfig => ({
    ...emptyConfig,
    slots: slots,
    bridge: { enabled: true }
  });

  let domIdCounter = 1;

  const adSlot = (domId: string): AdSlot => {
    return {
      domId: `${domId}-${domIdCounter++}`,
      adUnitPath: `/123/${domId}`,
      sizes: [
        [300, 250],
        [300, 200]
      ],
      position: 'in-page',
      sizeConfig: [],
      behaviour: { loaded: 'eager' }
    };
  };

  const postMessage = (data: BridgeProtocol): Promise<void> => {
    const serializedData = JSON.stringify(data);
    jsDomWindow.postMessage(serializedData, '*');
    let finishListener: (event: MessageEvent) => void;

    return new Promise((resolve, reject) => {
      finishListener = event => {
        if (event.data === serializedData) {
          resolve();
        } else {
          reject(`got an unexpected message ${event.data}`);
        }
        jsDomWindow.removeEventListener('message', finishListener);
      };
      jsDomWindow.addEventListener('message', finishListener);
    });
  };

  afterEach(() => {
    // event listeners stack up for each test case, so cleaning up the window is the best option
    sandbox.reset();
    jsDomWindow = createDomAndWindow().jsDomWindow;
    gpt = createGoogletagStub();
    pubads = gpt.pubads();
    jsDomWindow.googletag = gpt;

    moli = createMoliTag(jsDomWindow);
    jsDomWindow.moli = moli;

    pubadsRefreshSpy = sandbox.spy(pubads, 'refresh');
    pubadsGetSlotsStub = sandbox.stub(pubads, 'getSlots');
    addEventListenerSpy = sandbox.spy(jsDomWindow, 'addEventListener');
    googleAdSlotDestroySlotsSpy = sandbox.spy(gpt, 'destroySlots');
    moliRefreshAdSlotSpy = sandbox.spy(moli, 'refreshAdSlot');

    step = bridgeInitStep();
  });

  describe('bridge behaviour', () => {
    it('should not initialize the event listener if bridge config is undefined', async () => {
      await step(adPipelineContext(jsDomWindow, { config: { ...emptyConfig, bridge: undefined } }));
      expect(addEventListenerSpy).to.have.not.been.called;
    });
    it('should not initialize the event listener if bridge is disabled', async () => {
      await step(
        adPipelineContext(jsDomWindow, { config: { ...emptyConfig, bridge: { enabled: false } } })
      );
      expect(addEventListenerSpy).to.have.not.been.called;
    });
    it('should initialize the message listener if bridge is enabled', async () => {
      await step(adPipelineContext(jsDomWindow, { config: configWithBridge([]) }));
      expect(addEventListenerSpy).to.have.been.calledOnce;
      expect(addEventListenerSpy).to.have.been.calledOnceWith(
        Sinon.match.same('message'),
        Sinon.match.func
      );
    });
  });

  describe('h5.adunit.passback', () => {
    const passbackMessage = (options: Partial<PassbackMessage>): PassbackMessage => ({
      event: 'h5.adunit.passback',
      passbackOrigin: 'outstream-partner-1',
      ...options
    });

    let slot = adSlot('dom-id-1');
    let googleAdSlot = googleAdSlotStub(slot.adUnitPath, slot.domId);
    let googleAdSlotSetTargetingSpy = sandbox.spy(googleAdSlot, 'setTargeting');

    afterEach(() => {
      slot = adSlot('dom-id-1');
      googleAdSlot = googleAdSlotStub(slot.adUnitPath, slot.domId);
      googleAdSlotSetTargetingSpy = sandbox.spy(googleAdSlot, 'setTargeting');
    });

    describe('passback message with domId', () => {
      it('should not refresh the given ad slot does not exist', async () => {
        pubadsGetSlotsStub.returns([]);

        await step(adPipelineContext(jsDomWindow, { config: configWithBridge([]) }));
        await postMessage(passbackMessage({ domId: slot.domId }));

        expect(pubadsRefreshSpy).to.have.not.been.called;
        expect(googleAdSlotSetTargetingSpy).to.have.not.been.called;
      });

      it('should not refresh the given ad slot if domId does not match', async () => {
        pubadsGetSlotsStub.returns([googleAdSlot]);

        await step(adPipelineContext(jsDomWindow, { config: configWithBridge([]) }));
        await postMessage(passbackMessage({ domId: 'another-slot' }));

        expect(pubadsRefreshSpy).to.have.not.been.called;
        expect(googleAdSlotSetTargetingSpy).to.have.not.been.called;
      });

      it('should not refresh the given ad slot if the passback key value is already present', async () => {
        sandbox.stub(googleAdSlot, 'getTargeting').callsFake(key => {
          return key === 'passback' ? ['true'] : [];
        });
        pubadsGetSlotsStub.returns([googleAdSlot]);

        await step(adPipelineContext(jsDomWindow, { config: configWithBridge([]) }));
        await postMessage(passbackMessage({ domId: slot.domId }));

        expect(pubadsRefreshSpy).to.have.been.not.called;
        expect(googleAdSlotSetTargetingSpy).to.have.not.been.called;
      });

      it('should refresh the given ad slot', async () => {
        pubadsGetSlotsStub.returns([googleAdSlot]);

        await step(adPipelineContext(jsDomWindow, { config: configWithBridge([]) }));
        await postMessage(passbackMessage({ domId: slot.domId }));

        expect(pubadsRefreshSpy).to.have.been.called;
        expect(googleAdSlotSetTargetingSpy).to.have.been.called;
      });
    });

    describe('passback message with adUnitPath', () => {
      it('should not refresh the given ad slot does not exist', async () => {
        pubadsGetSlotsStub.returns([]);

        await step(adPipelineContext(jsDomWindow, { config: configWithBridge([]) }));
        await postMessage(passbackMessage({ adUnitPath: slot.adUnitPath }));

        expect(pubadsRefreshSpy).to.have.not.been.called;
        expect(googleAdSlotSetTargetingSpy).to.have.not.been.called;
      });

      it('should not refresh the given ad slot if adUnitPath does not match', async () => {
        pubadsGetSlotsStub.returns([googleAdSlot]);

        await step(adPipelineContext(jsDomWindow, { config: configWithBridge([]) }));
        await postMessage(passbackMessage({ adUnitPath: 'another-ad-unit-path' }));

        expect(pubadsRefreshSpy).to.have.not.been.called;
        expect(googleAdSlotSetTargetingSpy).to.have.not.been.called;
      });

      it('should not refresh the given ad slot if the passback key value is already present', async () => {
        sandbox.stub(googleAdSlot, 'getTargeting').callsFake(key => {
          return key === 'passback' ? ['true'] : [];
        });
        pubadsGetSlotsStub.returns([googleAdSlot]);

        await step(adPipelineContext(jsDomWindow, { config: configWithBridge([]) }));
        await postMessage(passbackMessage({ adUnitPath: slot.adUnitPath }));

        expect(pubadsRefreshSpy).to.have.been.not.called;
        expect(googleAdSlotSetTargetingSpy).to.have.not.been.called;
      });

      it('should refresh the given ad slot', async () => {
        pubadsGetSlotsStub.returns([googleAdSlot]);

        await step(adPipelineContext(jsDomWindow, { config: configWithBridge([]) }));
        await postMessage(passbackMessage({ adUnitPath: slot.adUnitPath }));

        expect(pubadsRefreshSpy).to.have.been.called;
        expect(googleAdSlotSetTargetingSpy).to.have.been.called;
      });
    });
  });

  describe('h5.adunit.refresh', () => {
    const refreshMessage = (domId: string): RefreshAdUnitMessage => ({
      event: 'h5.adunit.refresh',
      domId: domId
    });

    let slot: AdSlot = adSlot('dom-id-1');
    let backfillSlot: AdSlot = { ...slot, behaviour: { loaded: 'backfill' } };
    let googleAdSlot = googleAdSlotStub(slot.adUnitPath, slot.domId);
    let slots = [slot, backfillSlot];

    afterEach(() => {
      slot = adSlot('dom-id-1');
      backfillSlot = { ...slot, behaviour: { loaded: 'backfill' } };
      slots = [slot, backfillSlot];
      googleAdSlot = googleAdSlotStub(slot.adUnitPath, slot.domId);
    });

    it('should not refresh the given ad slot does not exist anywhere', async () => {
      pubadsGetSlotsStub.returns([]);

      await step(adPipelineContext(jsDomWindow, { config: configWithBridge([]) }));
      await postMessage(refreshMessage(slot.domId));

      expect(googleAdSlotDestroySlotsSpy).to.have.not.been.called;
      expect(moliRefreshAdSlotSpy).to.have.not.been.called;
    });

    it('should not refresh the given ad slot does not exist in gpt', async () => {
      pubadsGetSlotsStub.returns([]);

      await step(
        adPipelineContext(jsDomWindow, { config: configWithBridge([slot, backfillSlot]) })
      );
      await postMessage(refreshMessage(slot.domId));

      expect(googleAdSlotDestroySlotsSpy).to.have.not.been.called;
      expect(moliRefreshAdSlotSpy).to.have.not.been.called;
    });

    it('should not refresh the given ad slot does not exist in moli', async () => {
      pubadsGetSlotsStub.returns([googleAdSlot]);

      await step(adPipelineContext(jsDomWindow, { config: configWithBridge([slot]) }));
      await postMessage(refreshMessage(slot.domId));

      expect(googleAdSlotDestroySlotsSpy).to.have.not.been.called;
      expect(moliRefreshAdSlotSpy).to.have.not.been.called;
    });

    it('should not refresh the given ad slot if domId does not match', async () => {
      pubadsGetSlotsStub.returns([googleAdSlot]);

      await step(adPipelineContext(jsDomWindow, { config: configWithBridge(slots) }));
      await postMessage(refreshMessage('another-slot'));

      expect(googleAdSlotDestroySlotsSpy).to.have.not.been.called;
      expect(moliRefreshAdSlotSpy).to.have.not.been.called;
    });

    it('should refresh the given ad slot', async () => {
      pubadsGetSlotsStub.returns([googleAdSlot]);

      await step(adPipelineContext(jsDomWindow, { config: configWithBridge(slots) }));
      await postMessage(refreshMessage(slot.domId));

      expect(googleAdSlotDestroySlotsSpy).to.have.been.called;
      expect(moliRefreshAdSlotSpy).to.have.been.called;
      expect(moliRefreshAdSlotSpy).to.have.been.calledOnceWithExactly(slot.domId, {
        loaded: 'backfill'
      });
    });
  });
});
