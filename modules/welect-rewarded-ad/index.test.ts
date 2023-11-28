import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { createDom } from '@highfivve/ad-tag/lib/stubs/browserEnvSetup';

import { WelectRewardedAd } from './index';
import { emptyConfig, newEmptyConfig, noopLogger } from '@highfivve/ad-tag/lib/stubs/moliStubs';
import {
  AdPipelineContext,
  AssetLoadMethod,
  createAssetLoaderService,
  googletag
} from '@highfivve/ad-tag';
import { fullConsent } from '@highfivve/ad-tag/lib/stubs/consentStubs';
import { Moli } from '@highfivve/ad-tag/lib/types/moli';
import IPosition = Moli.IPosition;
import { googleAdSlotStub } from '@highfivve/ad-tag/lib/stubs/googletagStubs';

// setup sinon-chai
use(sinonChai);

describe('Welect Rewarded Ad Module', () => {
  const sandbox = Sinon.createSandbox();
  const dom = createDom();
  const jsDomWindow: Window & googletag.IGoogleTagWindow = dom.window as any;

  const assetLoaderService = createAssetLoaderService(jsDomWindow);
  const loadScriptStub = sandbox.stub(assetLoaderService, 'loadScript');

  let domIdCounter: number;
  let mkAdSlotInDOM: (index: number, position: IPosition) => Moli.AdSlot;

  const createWelect = (): WelectRewardedAd =>
    new WelectRewardedAd(
      {
        welectScript: 'http://localhost/welect.js'
      },
      jsDomWindow
    );

  beforeEach(() => {
    loadScriptStub.resolves();
    domIdCounter = 0;
  });

  afterEach(() => {
    sandbox.reset();
  });

  const adPipelineContext = (): AdPipelineContext => {
    return {
      requestId: 0,
      requestAdsCalls: 1,
      env: 'production',
      logger: noopLogger,
      config: emptyConfig,
      window: jsDomWindow as any,
      // no service dependencies required
      labelConfigService: null as any,
      reportingService: null as any,
      tcData: fullConsent({ 56: true }),
      adUnitPathVariables: {}
    };
  };

  mkAdSlotInDOM = (index: number, position: IPosition) => {
    const domId = 'rewarded-ad-unit' + index;
    const adDiv = jsDomWindow.document.createElement('div');
    adDiv.id = domId;
    jsDomWindow.document.body.appendChild(adDiv);
    return {
      domId: domId,
      adUnitPath: `/123/rewarded-ad-unit` + index,
      sizes: [],
      position: position,
      sizeConfig: [],
      behaviour: { loaded: 'manual' }
    };
  };

  it('should add an init step', async () => {
    const module = createWelect();
    const config = newEmptyConfig();

    module.init(config, assetLoaderService);

    expect(config.pipeline).to.be.ok;
    expect(config.pipeline?.configureSteps).to.have.length(1);
    expect(config.pipeline?.configureSteps[0].name).to.be.eq('welect-rewardedAd');
    expect(config.pipeline?.prepareRequestAdsSteps).to.have.length(1);
    expect(config.pipeline?.prepareRequestAdsSteps[0].name).to.be.eq('Rewarded Ad Setup');
  });

  it('shoud not load welect script if there is no adSlot with position rewarded', () => {
    const module = createWelect();
    const slots = [mkAdSlotInDOM(1, 'in-page')];

    module.loadWelect(adPipelineContext(), slots, assetLoaderService);
    expect(loadScriptStub).to.have.not.been.called;
  });

  it('should not load welect script if there is an adSlot with position rewarded', () => {
    const module = createWelect();
    const slots = [mkAdSlotInDOM(1, 'rewarded'), mkAdSlotInDOM(2, 'in-page')];

    module.loadWelect(adPipelineContext(), slots, assetLoaderService);
    expect(loadScriptStub).to.have.been.calledOnce;
    expect(loadScriptStub).to.have.been.calledOnceWithExactly({
      name: module.name,
      loadMethod: AssetLoadMethod.TAG,
      assetUrl: 'http://localhost/welect.js'
    });
  });

  it('should not call requestBids if there is multiple adSlots', async () => {
    const module = createWelect();
    const slot1 = mkAdSlotInDOM(1, 'rewarded');
    const slot2 = mkAdSlotInDOM(2, 'in-page');

    const config = newEmptyConfig([slot1, slot2]);
    const requestBidsSpy = sandbox.spy(module, 'requestBids');

    module.init(config, assetLoaderService);
    expect(config.pipeline?.prepareRequestAdsSteps).to.have.length(1);
    const rewardedAdRequestStep = config.pipeline?.prepareRequestAdsSteps[0];
    expect(rewardedAdRequestStep?.name).to.be.eq('Rewarded Ad Setup');
    await rewardedAdRequestStep!(adPipelineContext(), [
      {
        adSlot: googleAdSlotStub('/123/rewarded-ad-unit1', 'rewarded-ad-unit1'),
        moliSlot: slot1,
        filterSupportedSizes: () => []
      },
      {
        adSlot: googleAdSlotStub('/123/rewarded-ad-unit2', 'rewarded-ad-unit2'),
        moliSlot: slot2,
        filterSupportedSizes: () => []
      }
    ]);
    expect(requestBidsSpy).to.have.not.been.called;
  });

  it('should call requestBids if there is only one rewarded adSlot', async () => {
    const module = createWelect();
    const slot1 = mkAdSlotInDOM(1, 'rewarded');

    const config = newEmptyConfig([slot1]);
    const requestBidsSpy = sandbox.spy(module, 'requestBids');

    module.init(config, assetLoaderService);
    expect(config.pipeline?.prepareRequestAdsSteps).to.have.length(1);
    const rewardedAdRequestStep = config.pipeline?.prepareRequestAdsSteps[0];
    expect(rewardedAdRequestStep?.name).to.be.eq('Rewarded Ad Setup');
    await rewardedAdRequestStep!(adPipelineContext(), [
      {
        adSlot: googleAdSlotStub('/123/rewarded-ad-unit1', 'rewarded-ad-unit1'),
        moliSlot: slot1,
        filterSupportedSizes: () => []
      }
    ]);
    expect(requestBidsSpy).to.have.been.called;
  });
});
