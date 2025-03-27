import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { createDom } from '@highfivve/ad-tag/lib/stubs/browserEnvSetup';

import { Utiq, UtiqConfigOptions } from './index';
import { emptyConfig, newEmptyConfig, noopLogger } from '@highfivve/ad-tag/lib/stubs/moliStubs';
import {
  AdPipelineContext,
  AssetLoadMethod,
  createAssetLoaderService,
  googletag,
  prebidjs,
  tcfapi
} from '@highfivve/ad-tag';
import { fullConsent, tcDataNoGdpr } from '@highfivve/ad-tag/lib/stubs/consentStubs';
import { GlobalAuctionContext } from '@highfivve/ad-tag/lib/ads/globalAuctionContext';
import { EventService } from '@highfivve/ad-tag/lib/ads/eventService';

// setup sinon-chai
use(sinonChai);

describe('Utiq Module', () => {
  const sandbox = Sinon.createSandbox();
  const dom = createDom();
  const jsDomWindow: Window &
    googletag.IGoogleTagWindow &
    prebidjs.IPrebidjsWindow &
    Pick<typeof globalThis, 'Date'> = dom.window as any;

  const assetLoaderService = createAssetLoaderService(jsDomWindow);
  const loadScriptStub = sandbox.stub(assetLoaderService, 'loadScript');

  const createUtiq = (options?: UtiqConfigOptions): Utiq =>
    new Utiq({
      enabled: true,
      assetUrl: 'http://localhost/utiq.js',
      options
    });

  beforeEach(() => {
    loadScriptStub.resolves();
  });

  afterEach(() => {
    sandbox.reset();
  });

  it('should add an init step', async () => {
    const module = createUtiq();
    const config = newEmptyConfig();

    module.init(config, assetLoaderService);

    expect(config.pipeline).to.be.ok;
    expect(config.pipeline?.initSteps).to.have.length(1);
    expect(config.pipeline?.initSteps[0].name).to.be.eq('utiq');
  });

  describe('loadUtiq', () => {
    const module = createUtiq();
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
        adUnitPathVariables: {},
        auction: new GlobalAuctionContext(jsDomWindow, noopLogger, new EventService())
      };
    };

    it('not load anything in a test environment', async () => {
      await module.loadUtiq({ ...adPipelineContext(), env: 'test' }, assetLoaderService);
      expect(loadScriptStub).to.have.not.been.called;
    });

    [
      tcfapi.responses.TCPurpose.STORE_INFORMATION_ON_DEVICE,
      tcfapi.responses.TCPurpose.SELECT_BASIC_ADS,
      tcfapi.responses.TCPurpose.CREATE_PERSONALISED_ADS_PROFILE,
      tcfapi.responses.TCPurpose.SELECT_PERSONALISED_ADS,
      tcfapi.responses.TCPurpose.CREATE_PERSONALISED_CONTENT_PROFILE,
      tcfapi.responses.TCPurpose.SELECT_PERSONALISED_CONTENT,
      tcfapi.responses.TCPurpose.MEASURE_AD_PERFORMANCE,
      tcfapi.responses.TCPurpose.MEASURE_CONTENT_PERFORMANCE,
      tcfapi.responses.TCPurpose.APPLY_MARKET_RESEARCH,
      tcfapi.responses.TCPurpose.DEVELOP_IMPROVE_PRODUCTS,
      tcfapi.responses.TCPurpose.USE_LIMITED_DATA_TO_SElECT_CONTENT
    ].forEach(purposeId => {
      it(`not load anything if gdpr applies and purpose ${purposeId} is missing`, async () => {
        const tcDataFullConsent = fullConsent();
        await module.loadUtiq(
          {
            ...adPipelineContext(),
            tcData: {
              ...tcDataFullConsent,
              purpose: {
                ...tcDataFullConsent.purpose,
                consents: { ...tcDataFullConsent.purpose.consents, [purposeId]: false }
              }
            }
          },
          assetLoaderService
        );
        expect(loadScriptStub).to.have.not.been.called;
      });
    });

    it('load utiq if gdpr does not apply', async () => {
      await module.loadUtiq({ ...adPipelineContext(), tcData: tcDataNoGdpr }, assetLoaderService);
      expect(loadScriptStub).to.have.been.calledOnce;
      expect(loadScriptStub).to.have.been.calledOnceWithExactly({
        name: module.name,
        loadMethod: AssetLoadMethod.TAG,
        assetUrl: 'http://localhost/utiq.js'
      });
    });

    it('load utiq if gdpr does apply and consent for all 11 purposes is given', async () => {
      await module.loadUtiq(adPipelineContext(), assetLoaderService);
      expect(loadScriptStub).to.have.been.calledOnce;
      expect(loadScriptStub).to.have.been.calledOnceWithExactly({
        name: module.name,
        loadMethod: AssetLoadMethod.TAG,
        assetUrl: 'http://localhost/utiq.js'
      });
    });
  });
});
