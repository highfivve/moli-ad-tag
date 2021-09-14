import {
  AdPipeline,
  AdPipelineContext,
  createAssetLoaderService,
  googletag,
  IAdPipelineConfiguration,
  mkInitStep,
  Moli,
  prebidjs,
  SlotEventService,
  tcfapi
} from '@highfivve/ad-tag';

import { createDom } from '@highfivve/ad-tag/lib/stubs/browserEnvSetup';
import { createGoogletagStub } from '@highfivve/ad-tag/lib/stubs/googletagStubs';
import { noopLogger } from '@highfivve/ad-tag/lib/stubs/moliStubs';
import { reportingServiceStub } from '@highfivve/ad-tag/lib/stubs/reportingServiceStub';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';

import { PrebidFirstPartyDataModule } from './index';
import TCData = tcfapi.responses.TCData;

use(sinonChai);
use(chaiAsPromised);

describe('The Adex DMP Module', () => {
  const sandbox = Sinon.createSandbox();
  let dom = createDom();
  let jsDomWindow: Window & googletag.IGoogleTagWindow & prebidjs.IPrebidjsWindow =
    dom.window as any;

  const assetLoaderService = createAssetLoaderService(jsDomWindow);
  const reportingService = reportingServiceStub();
  const slotEventService = new SlotEventService(noopLogger);
  const emptyPipelineConfig: IAdPipelineConfiguration = {
    init: [],
    configure: [],
    defineSlots: () => Promise.resolve([]),
    prepareRequestAds: [],
    requestBids: [],
    requestAds: () => Promise.resolve()
  };
  const adPipelineContext = (
    config: Moli.MoliConfig,
    tcData?: Partial<TCData>
  ): AdPipelineContext => {
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
      slotEventService: null as any,
      tcData: {
        gdprApplies: true,
        vendor: {
          consents: { '44': true }
        },
        purpose: {
          consents: {
            1: true,
            2: true,
            3: true,
            4: true,
            5: true,
            6: true,
            7: true,
            8: true,
            9: true,
            10: true
          }
        },
        ...tcData
      } as unknown as TCData
    };
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

  const createFpdModule = (
    firstPartyData: prebidjs.firstpartydata.PrebidFirstPartyData
  ): PrebidFirstPartyDataModule => {
    return new PrebidFirstPartyDataModule({
      firstPartyData
    });
  };

  const initModule = (config: {
    module: PrebidFirstPartyDataModule;
    configPipeline?: Moli.pipeline.PipelineConfig;
    moliSlot?: Moli.AdSlot;
  }) => {
    const { moliSlot, configPipeline, module } = config;
    const slot = moliSlot || ({ domId: 'foo' } as Moli.AdSlot);

    const moliConfig: Moli.MoliConfig = {
      slots: [slot],
      pipeline: configPipeline,
      logger: noopLogger
    };

    const adPipeline = new AdPipeline(
      emptyPipelineConfig,
      noopLogger,
      jsDomWindow,
      reportingService,
      slotEventService
    );

    module.init(moliConfig, assetLoaderService, () => adPipeline);

    return { moliConfig, adPipeline };
  };

  it('should add a configure step', () => {
    const module = createFpdModule({});

    const configPipeline = {
      initSteps: [mkInitStep('stub', _ => Promise.resolve())],
      configureSteps: [],
      prepareRequestAdsSteps: []
    };

    const { moliConfig } = initModule({ module, configPipeline });

    expect(moliConfig.pipeline).to.be.ok;

    // initialization adds one configureStep and one prepareRequestAdsStep
    expect(moliConfig.pipeline?.initSteps).to.have.lengthOf(1);
    expect(moliConfig.pipeline?.configureSteps).to.have.lengthOf(1);
    expect(moliConfig.pipeline?.prepareRequestAdsSteps).to.have.lengthOf(0);
  });

  it('should add prebid first party data targeting to moli', () => {
    const module = createFpdModule({ user: { gender: 'O', yob: 1337, keywords: 'some,nice,guy' } });

    const configPipeline = {
      initSteps: [mkInitStep('stub', _ => Promise.resolve())],
      configureSteps: [],
      prepareRequestAdsSteps: []
    };

    const { moliConfig } = initModule({ module, configPipeline });

    expect(moliConfig.pipeline).to.be.ok;

    // initialization adds one configureStep and one prepareRequestAdsStep
    expect(moliConfig.pipeline?.initSteps).to.have.lengthOf(1);
    expect(moliConfig.pipeline?.configureSteps).to.have.lengthOf(1);
    expect(moliConfig.pipeline?.prepareRequestAdsSteps).to.have.lengthOf(0);
  });
});
