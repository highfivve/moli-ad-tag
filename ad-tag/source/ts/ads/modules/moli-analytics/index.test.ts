import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { createDomAndWindow } from 'ad-tag/stubs/browserEnvSetup';
import { MoliAnalytics } from 'ad-tag/ads/modules/moli-analytics/index';
import { adPipelineContext } from 'ad-tag/stubs/adPipelineContextStubs';
import { prebidjs } from 'ad-tag/types/prebidjs';
import { createPbjsStub } from 'ad-tag/stubs/prebidjsStubs';

use(sinonChai);

describe('Moli Analytics Module', () => {
  const sandbox = Sinon.createSandbox();
  let { jsDomWindow } = createDomAndWindow();

  const defaultContext = adPipelineContext(jsDomWindow);
  const defaultUrl = 'https://example.com/analytics';
  const defaultBatchSize = 10;

  const createAndConfigureModule = (url: string, batchSize?: number) => {
    const module = MoliAnalytics();
    module.configure__({
      moliAnalytics: {
        enabled: true,
        url: url,
        batchSize: batchSize
      }
    });
    return module;
  };

  const testAnalyticsConfiguration = async (url: string, batchSize?: number) => {
    const loadAnalyticsStub = sandbox.spy(jsDomWindow.pbjs, 'enableAnalytics');

    const module = createAndConfigureModule(url, batchSize);
    await module.initSteps__()[0](defaultContext);

    expect(loadAnalyticsStub).to.have.been.calledOnce;
    expect(loadAnalyticsStub.args[0][0][0].options).to.not.be.undefined;

    const options = loadAnalyticsStub.args[0][0][0]
      .options as prebidjs.analytics.IGenericAnalyticsAdapterOptions;

    return options;
  };

  beforeEach(() => {
    jsDomWindow.pbjs = createPbjsStub();
  });

  afterEach(() => {
    sandbox.reset();
    sandbox.restore();
  });

  it('should load with the specified url', async () => {
    const options = await testAnalyticsConfiguration(defaultUrl);
    expect(options.url).to.equal(defaultUrl);
  });

  it('should load with the specified batch size', async () => {
    const options = await testAnalyticsConfiguration(defaultUrl, defaultBatchSize);
    expect(options.batchSize).to.equal(defaultBatchSize);
  });

  it('should not load if not configured', async () => {
    const loadAnalyticsStub = sandbox.stub(jsDomWindow.pbjs, 'enableAnalytics');

    const module = MoliAnalytics();
    await module
      .initSteps__()[0](defaultContext)
      .catch(() => {
        /* expected to fail */
      });
    expect(loadAnalyticsStub).to.not.have.been.called;
  });

  it('set analytics label from moli config', async () => {
    const setLabelsStub = sandbox.stub(jsDomWindow.pbjs, 'mergeConfig');
    const expectedConfig = {
      analyticsLabels: {
        pubstackAbCohort: null,
        configVariant: '1'
      }
    };

    const module = createAndConfigureModule(defaultUrl, defaultBatchSize);
    await module.initSteps__()[1]({
      ...defaultContext,
      config__: {
        ...defaultContext.config__,
        configVersion: { versionNumber: 1, versionVariant: '1', identifier: '1_1' }
      }
    });

    expect(setLabelsStub).to.have.been.calledOnceWithExactly(expectedConfig);
  });
});
