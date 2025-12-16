import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { createMoliTag } from 'ad-tag/ads/moli';
import { createDomAndWindow } from 'ad-tag/stubs/browserEnvSetup';
import { adPipelineContext } from 'ad-tag/stubs/adPipelineContextStubs';
import { createPbjsStub } from 'ad-tag/stubs/prebidjsStubs';
import { MoliAnalytics, DEFAULT_CONFIG } from 'ad-tag/ads/modules/moli-analytics/index';
import { createSession } from 'ad-tag/ads/modules/moli-analytics/session';
import * as eventTracker from 'ad-tag/ads/modules/moli-analytics/eventTracker';
import { modules } from 'ad-tag/types/moliConfig';

use(sinonChai);

describe('Moli Analytics Module', () => {
  const sandbox = Sinon.createSandbox();
  let { jsDomWindow } = createDomAndWindow();

  const defaultContext = adPipelineContext(jsDomWindow);
  const defaultConfig: modules.moliAnalytics.MoliAnalyticsConfig = {
    enabled: true,
    publisher: 'example-publisher',
    url: 'https://example.com/analytics'
  };

  const createAndConfigureModule = (config: modules.moliAnalytics.MoliAnalyticsConfig) => {
    const module = MoliAnalytics();
    module.configure__({
      moliAnalytics: config
    });
    return module;
  };

  beforeEach(() => {
    sandbox.useFakeTimers({ now: 1000 });
    jsDomWindow.pbjs = createPbjsStub();
    jsDomWindow.moli = createMoliTag(jsDomWindow);
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should load with default values', async () => {
    const module = createAndConfigureModule(defaultConfig);
    const config = module.config__();
    let initSuccess = false;

    await module
      .initSteps__()[0](defaultContext)
      .then(() => {
        initSuccess = true;
      });

    expect(initSuccess).is.true;
    expect(config).have.property('publisher', defaultConfig.publisher);
    expect(config).have.property('url', defaultConfig.url);
    expect(config).have.property('batchSize', DEFAULT_CONFIG.batchSize);
    expect(config).have.property('batchDelay', DEFAULT_CONFIG.batchDelay);
  });

  [
    undefined,
    { enabled: true },
    { enabled: true, publisher: defaultConfig.publisher },
    { enabled: true, publisher: defaultConfig.publisher, url: defaultConfig.url, batchSize: 0 },
    {
      enabled: true,
      publisher: defaultConfig.publisher,
      url: defaultConfig.url,
      batchSize: 2,
      batchDelay: 0
    },
    {
      enabled: false,
      publisher: defaultConfig.publisher,
      url: defaultConfig.url,
      batchSize: 2,
      batchDelay: 100
    }
  ].forEach((config, index) => {
    it('should not load if not configured, run: ' + index, async () => {
      const createSessionSpy = sandbox.spy(createSession);
      const createEventTrackerStub = sandbox.stub(eventTracker, 'createEventTracker');
      const prebidStub = sandbox.stub(jsDomWindow.pbjs, 'onEvent');
      const gptStub = sandbox.stub(jsDomWindow.googletag.cmd, 'push');
      const module = createAndConfigureModule(config as modules.moliAnalytics.MoliAnalyticsConfig);
      let initFailed = false;

      await module
        .initSteps__()[0](defaultContext)
        .catch(() => {
          /* expected to fail */
          initFailed = true;
        });

      expect(initFailed).to.be.true;
      expect(createSessionSpy).to.not.have.been.called;
      expect(createEventTrackerStub).to.not.have.been.called;
      expect(prebidStub).to.not.have.been.called;
      expect(gptStub).to.not.have.been.called;
    });
  });

  it('should dispatch page view event on init', async () => {
    const trackSpy = sandbox.spy();
    const createEventTrackerStub = sandbox
      .stub(eventTracker, 'createEventTracker')
      .returns({ track: trackSpy });
    const module = createAndConfigureModule(defaultConfig);

    await module.initSteps__()[0](defaultContext);

    expect(createEventTrackerStub).calledOnce;
    expect(trackSpy).calledOnce;
    expect(trackSpy.firstCall.firstArg).an('object').and.have.property('type', 'page.view');
  });

  it('should dispatch page view event on spa page change', async () => {
    const trackSpy = sandbox.spy();
    sandbox.stub(eventTracker, 'createEventTracker').returns({ track: trackSpy });

    const { jsDomWindow } = createDomAndWindow();
    const moliTag = createMoliTag(jsDomWindow);
    const moliAddListenerStub = sandbox.stub(moliTag, 'addEventListener');
    jsDomWindow.moli = moliTag;

    const context = adPipelineContext(jsDomWindow, {
      config__: {
        ...defaultContext.config__,
        spa: {
          enabled: true,
          validateLocation: 'href'
        }
      }
    });
    const module = createAndConfigureModule(defaultConfig);
    await module.initSteps__()[0](context);

    // Should add afterRequestAds listener
    expect(moliAddListenerStub).calledOnce;
    expect(moliAddListenerStub.firstCall.firstArg).eq('afterRequestAds');
    expect(moliAddListenerStub.firstCall.lastArg).to.be.a('function');
    // Page view should not be fired yet
    expect(trackSpy).calledOnce;
    expect(trackSpy.firstCall.firstArg).an('object').and.have.property('type', 'page.view');

    // Call afterRequestAds listener
    moliAddListenerStub.firstCall.lastArg({ state: 'spa-finished' });

    // Page view event should be tracked again with the new pageViewId
    expect(trackSpy).calledTwice;
    expect(trackSpy.secondCall.firstArg).an('object').and.have.property('type', 'page.view');
    expect(trackSpy.secondCall.firstArg.payload.data.pageViewId).not.eq(
      trackSpy.firstCall.firstArg.payload.data.pageViewId
    );
  });

  it('should use analytics labels from moli config', async () => {
    const trackSpy = sandbox.spy();
    sandbox.stub(eventTracker, 'createEventTracker').returns({ track: trackSpy });

    const module = createAndConfigureModule(defaultConfig);
    await module.initSteps__()[0]({
      ...defaultContext,
      config__: {
        ...defaultContext.config__,
        configVersion: { versionNumber: 1, versionVariant: 'A', identifier: 'A_1' }
      }
    });

    expect(trackSpy).calledOnce;
    expect(trackSpy.firstCall.firstArg)
      .an('object')
      .and.nested.property('payload.data.analyticsLabels.variant', 'A');
    expect(trackSpy.firstCall.firstArg)
      .an('object')
      .and.nested.property('payload.data.analyticsLabels.ab_test', 'A_1');
  });

  it('set analytics label from moli config', async () => {
    const setLabelsStub = sandbox.stub(jsDomWindow.pbjs, 'mergeConfig');
    const expectedConfig = {
      analyticsLabels: {
        pubstackAbCohort: null,
        configVariant: '1'
      }
    };

    const module = createAndConfigureModule(defaultConfig);
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
