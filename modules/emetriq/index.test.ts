import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { createDom } from '@highfivve/ad-tag/lib/stubs/browserEnvSetup';
import {
  AssetLoadMethod,
  createAssetLoaderService
} from '@highfivve/ad-tag/source/ts/util/assetLoaderService';

import { Emetriq } from './index';
import { emptyConfig, newEmptyConfig, noopLogger } from '@highfivve/ad-tag/lib/stubs/moliStubs';
import { AdPipelineContext } from '@highfivve/ad-tag';
import { fullConsent, tcDataNoGdpr } from '@highfivve/ad-tag/lib/stubs/consentStubs';
import { EmetriqParams, EmetriqWindow } from './types/emetriq';

// setup sinon-chai
use(sinonChai);

describe('Emetriq Module', () => {
  const sandbox = Sinon.createSandbox();
  const dom = createDom();
  const jsDomWindow: EmetriqWindow = dom.window as any;

  const assetLoaderService = createAssetLoaderService(jsDomWindow);
  const loadScriptStub = sandbox.stub(assetLoaderService, 'loadScript');

  const sid = 1337;
  const createEmetriq = (): Emetriq =>
    new Emetriq(
      {
        sid: sid
      },
      jsDomWindow
    );

  beforeEach(() => {
    loadScriptStub.resolves();
  });

  afterEach(() => {
    sandbox.reset();
  });

  it('should add an init step', async () => {
    const module = createEmetriq();
    const config = newEmptyConfig();

    module.init(config, assetLoaderService);

    expect(config.pipeline).to.be.ok;
    expect(config.pipeline?.initSteps).to.have.length(1);
    expect(config.pipeline?.initSteps[0].name).to.be.eq('emetriq');
  });

  describe('loadEmetriq', () => {
    const module = createEmetriq();
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
        tcData: fullConsent({ 213: true }),
        adUnitPathVariables: {}
      };
    };

    it('not load anything in a test environment', async () => {
      await module.loadEmetriq({ ...adPipelineContext(), env: 'test' }, assetLoaderService);
      expect(loadScriptStub).to.have.not.been.called;
    });

    it('not load anything if gdpr applies and vendor 213 has no consent', async () => {
      await module.loadEmetriq(
        { ...adPipelineContext(), tcData: fullConsent({ 213: false }) },
        assetLoaderService
      );
      expect(loadScriptStub).to.have.not.been.called;
    });

    [adPipelineContext(), { ...adPipelineContext(), tcData: tcDataNoGdpr }].forEach(context =>
      it(`load emetriq if gdpr ${
        context.tcData.gdprApplies ? 'applies' : 'does not apply'
      }`, async () => {
        await module.loadEmetriq(context, assetLoaderService);

        expect(loadScriptStub).to.have.been.calledOnceWithExactly({
          name: module.name,
          loadMethod: AssetLoadMethod.TAG,
          assetUrl: `https://ups.xplosion.de/loader/${sid}/default.js`
        });
      })
    );

    it('should set window._enqAdpParam from config', async () => {
      const moduleConfig: EmetriqParams = {
        sid: 55,
        zip: '12345',
        custom1: '12,34,56',
        custom4: 'yes',
        id_sharedid: '123'
      };
      const module = new Emetriq(moduleConfig, jsDomWindow);
      await module.loadEmetriq(adPipelineContext(), assetLoaderService);

      expect(jsDomWindow._enqAdpParam).to.be.ok;
      expect(jsDomWindow._enqAdpParam).to.be.deep.eq(moduleConfig);
    });
  });
});
