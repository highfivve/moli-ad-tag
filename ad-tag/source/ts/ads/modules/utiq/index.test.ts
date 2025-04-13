import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';

import { createDomAndWindow } from 'ad-tag/stubs/browserEnvSetup';
import { modules } from 'ad-tag/types/moliConfig';
import { tcfapi } from 'ad-tag/types/tcfapi';
import { AssetLoadMethod, createAssetLoaderService } from 'ad-tag/util/assetLoaderService';

import { AdPipelineContext } from 'ad-tag/ads/adPipeline';
import {
  emptyConfig,
  emptyRuntimeConfig,
  newGlobalAuctionContext,
  noopLogger
} from 'ad-tag/stubs/moliStubs';
import { fullConsent, tcDataNoGdpr } from 'ad-tag/stubs/consentStubs';
import { Utiq } from './index';

// setup sinon-chai
use(sinonChai);

describe('Utiq Module', () => {
  const sandbox = Sinon.createSandbox();
  const { jsDomWindow } = createDomAndWindow();

  const assetLoaderService = createAssetLoaderService(jsDomWindow);
  const loadScriptStub = sandbox.stub(assetLoaderService, 'loadScript');

  const createUtiq = (options?: modules.utiq.UtiqConfigOptions): Utiq => {
    const module = new Utiq();
    module.configure__({
      utiq: {
        enabled: true,
        assetUrl: 'http://localhost/utiqLoader.js',
        ...options
      }
    });
    return module;
  };

  beforeEach(() => {
    loadScriptStub.resolves();
  });

  afterEach(() => {
    sandbox.reset();
  });

  it('should add an init step', async () => {
    const module = createUtiq();

    const initStep = module.initSteps__()[0];

    expect(initStep).to.have.length(1);
    expect(initStep.name).to.be.eq('utiq');
  });

  describe('loadUtiq', () => {
    const module = createUtiq();
    const adPipelineContext = (): AdPipelineContext => {
      return {
        auctionId: 'xxxx-xxxx-xxxx-xxxx',
        requestId: 0,
        requestAdsCalls: 1,
        env: 'production',
        logger: noopLogger,
        config: emptyConfig,
        runtimeConfig: emptyRuntimeConfig,
        window: jsDomWindow,
        // no service dependencies required
        labelConfigService: null as any,
        tcData: fullConsent({ 56: true }),
        adUnitPathVariables: {},
        auction: newGlobalAuctionContext(jsDomWindow),
        assetLoaderService: assetLoaderService
      };
    };

    it('not load anything in a test environment', async () => {
      await module.loadUtiq(
        { enabled: true, assetUrl: 'http://localhost/utiqLoader.js' },
        {
          ...adPipelineContext(),
          env: 'test'
        }
      );
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
          { enabled: true, assetUrl: 'http://localhost/utiqLoader.js' },
          {
            ...adPipelineContext(),
            tcData: {
              ...tcDataFullConsent,
              purpose: {
                ...tcDataFullConsent.purpose,
                consents: { ...tcDataFullConsent.purpose.consents, [purposeId]: false }
              }
            }
          }
        );
        expect(loadScriptStub).to.have.not.been.called;
      });
    });

    it('load utiq if gdpr does not apply', async () => {
      await module.loadUtiq(
        { enabled: true, assetUrl: 'http://localhost/utiqLoader.js' },
        {
          ...adPipelineContext(),
          tcData: tcDataNoGdpr
        }
      );
      expect(loadScriptStub).to.have.been.calledOnce;
      expect(loadScriptStub).to.have.been.calledOnceWithExactly({
        name: module.name,
        loadMethod: AssetLoadMethod.TAG,
        assetUrl: 'http://localhost/utiqLoader.js'
      });
    });

    it('load utiq if gdpr does apply and consent for all 11 purposes is given', async () => {
      await module.loadUtiq(
        { enabled: true, assetUrl: 'http://localhost/utiqLoader.js' },
        adPipelineContext()
      );
      expect(loadScriptStub).to.have.been.calledOnce;
      expect(loadScriptStub).to.have.been.calledOnceWithExactly({
        name: module.name,
        loadMethod: AssetLoadMethod.TAG,
        assetUrl: 'http://localhost/utiqLoader.js'
      });
    });
  });
});
