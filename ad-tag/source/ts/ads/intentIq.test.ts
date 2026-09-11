import { expect, use } from 'chai';
import sinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';
import * as Sinon from 'sinon';

import { createDomAndWindow } from '../stubs/browserEnvSetup';
import { createAssetLoaderService } from '../util/assetLoaderService';
import { createIntentIqAnalyticsAdapter, enrichIntentIqId, loadIntentIqScript } from './intentIq';
import { prebidjs } from '../types/prebidjs';

// setup sinon-chai
use(sinonChai);
use(chaiAsPromised);

describe('intentIq', () => {
  // single sandbox instance to create spies and stubs
  const sandbox = Sinon.createSandbox();

  const { jsDomWindow } = createDomAndWindow();
  const googletagStub = { cmd: [], pubads: () => ({}) } as any;

  afterEach(() => {
    sandbox.reset();
    delete (jsDomWindow as any).googletag;
  });

  after(() => {
    sandbox.restore();
  });

  const intentIqProvider = (
    overrides?: Partial<prebidjs.userSync.IIntentIqIdProviderParams>,
    storage?: Partial<prebidjs.userSync.IUserIdStorage>
  ): prebidjs.userSync.IIntentIqIdProvider => ({
    name: 'intentIqId',
    storage: {
      type: 'html5',
      name: 'intentIqId',
      expires: 0,
      ...storage
    },
    params: {
      partner: 12345,
      ...overrides
    }
  });

  const otherProvider: prebidjs.userSync.IID5Provider = {
    name: 'id5Id',
    storage: { type: 'html5', name: 'id5id', expires: 90 },
    params: { partner: 1519 }
  };

  describe('enrichIntentIqId', () => {
    it('should return undefined if userIds is undefined', () => {
      const result = enrichIntentIqId(jsDomWindow, { domain: 'example.com' }, undefined);
      expect(result).to.be.undefined;
    });

    it('should return unchanged userIds if intentIqId provider is not configured', () => {
      const userIds = [otherProvider];
      const result = enrichIntentIqId(jsDomWindow, { domain: 'example.com' }, userIds);
      expect(result).to.deep.equal(userIds);
    });

    it('should fill domainName from adUnitPathVariables.domain', () => {
      const result = enrichIntentIqId(jsDomWindow, { domain: 'example.com' }, [intentIqProvider()]);

      const provider = result?.find(
        p => p.name === 'intentIqId'
      ) as prebidjs.userSync.IIntentIqIdProvider;
      expect(provider.params.domainName).to.equal('example.com');
    });

    it('should always hardcode region to gdpr', () => {
      const result = enrichIntentIqId(jsDomWindow, { domain: 'example.com' }, [
        intentIqProvider({ region: 'apac' as any })
      ]);

      const provider = result?.find(
        p => p.name === 'intentIqId'
      ) as prebidjs.userSync.IIntentIqIdProvider;
      expect(provider.params.region).to.equal('gdpr');
    });

    it('should not set gamObjectReference if gamParameterName is not configured', () => {
      (jsDomWindow as any).googletag = googletagStub;
      const result = enrichIntentIqId(jsDomWindow, { domain: 'example.com' }, [intentIqProvider()]);

      const provider = result?.find(
        p => p.name === 'intentIqId'
      ) as prebidjs.userSync.IIntentIqIdProvider;
      expect(provider.params.gamObjectReference).to.be.undefined;
    });

    it('should inject window.googletag as gamObjectReference if gamParameterName is configured', () => {
      (jsDomWindow as any).googletag = googletagStub;
      const result = enrichIntentIqId(jsDomWindow, { domain: 'example.com' }, [
        intentIqProvider({ gamParameterName: 'intent_iq_group' })
      ]);

      const provider = result?.find(
        p => p.name === 'intentIqId'
      ) as prebidjs.userSync.IIntentIqIdProvider;
      expect(provider.params.gamObjectReference).to.equal(googletagStub);
    });

    it('should hardcode storage type/name and default expires/refreshInSeconds to 0', () => {
      const result = enrichIntentIqId(jsDomWindow, { domain: 'example.com' }, [
        {
          name: 'intentIqId',
          params: { partner: 12345 }
        }
      ]);

      const provider = result?.find(
        p => p.name === 'intentIqId'
      ) as prebidjs.userSync.IIntentIqIdProvider;
      expect(provider.storage).to.deep.equal({
        type: 'html5',
        name: 'intentIqId',
        expires: 0,
        refreshInSeconds: 0
      });
    });

    it('should keep the configured expires/refreshInSeconds while hardcoding type/name', () => {
      const result = enrichIntentIqId(jsDomWindow, { domain: 'example.com' }, [
        intentIqProvider(undefined, { expires: 30, refreshInSeconds: 3600 })
      ]);

      const provider = result?.find(
        p => p.name === 'intentIqId'
      ) as prebidjs.userSync.IIntentIqIdProvider;
      expect(provider.storage).to.deep.equal({
        type: 'html5',
        name: 'intentIqId',
        expires: 30,
        refreshInSeconds: 3600
      });
    });

    it('should not touch other configured userId providers', () => {
      const result = enrichIntentIqId(jsDomWindow, { domain: 'example.com' }, [
        otherProvider,
        intentIqProvider()
      ]);

      expect(result).to.have.length(2);
      expect(result?.find(p => p.name === 'id5Id')).to.deep.equal(otherProvider);
    });
  });

  describe('createIntentIqAnalyticsAdapter', () => {
    it('should return undefined if userIds is undefined', () => {
      expect(createIntentIqAnalyticsAdapter(undefined)).to.be.undefined;
    });

    it('should return undefined if intentIqId provider is not configured', () => {
      expect(createIntentIqAnalyticsAdapter([otherProvider])).to.be.undefined;
    });

    it('should build the iiqAnalytics adapter config sharing fields with the userId provider', () => {
      const enriched = enrichIntentIqId(jsDomWindow, { domain: 'example.com' }, [
        intentIqProvider({
          ABTestingConfigurationSource: 'percentage',
          browserBlackList: 'chrome',
          group: 'A',
          abPercentage: 50
        })
      ]);

      const adapter = createIntentIqAnalyticsAdapter(enriched);

      expect(adapter).to.deep.equal({
        provider: 'iiqAnalytics',
        options: {
          partner: 12345,
          region: 'gdpr',
          ABTestingConfigurationSource: 'percentage',
          browserBlackList: 'chrome',
          domainName: 'example.com',
          group: 'A',
          abPercentage: 50,
          gamObjectReference: undefined
        }
      });
    });
  });

  describe('loadIntentIqScript', () => {
    const assetLoaderService = createAssetLoaderService(jsDomWindow);
    const loadScriptStub = sandbox.stub(assetLoaderService, 'loadScript').resolves();

    it('should not load a script if userIds is undefined', () => {
      loadIntentIqScript(assetLoaderService, undefined);
      expect(loadScriptStub).to.not.have.been.called;
    });

    it('should not load a script if intentIqId provider is not configured', () => {
      loadIntentIqScript(assetLoaderService, [otherProvider]);
      expect(loadScriptStub).to.not.have.been.called;
    });

    it('should not load a script if scriptUrl is not configured', () => {
      loadIntentIqScript(assetLoaderService, [intentIqProvider()]);
      expect(loadScriptStub).to.not.have.been.called;
    });

    it('should load the script via the asset loader service if scriptUrl is configured', () => {
      const scriptUrl = 'https://cdn.intentiq.com/script.js';
      loadIntentIqScript(assetLoaderService, [intentIqProvider({ scriptUrl })]);

      expect(loadScriptStub).to.have.been.calledOnce;
      const [config] = loadScriptStub.getCall(0).args;
      expect(config.assetUrl).to.equal(scriptUrl);
    });
  });
});
