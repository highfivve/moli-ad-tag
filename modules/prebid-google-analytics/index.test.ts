import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import PrebidGoogleAnalytics from './index';
import { Moli, createAssetLoaderService } from '@highfivve/ad-tag';
import { newNoopLogger } from '@highfivve/ad-tag/lib/tests/ts/stubs/moliStubs';
import { pbjsTestConfig } from '@highfivve/ad-tag/lib/tests/ts/stubs/prebidjsStubs';
import { createDom } from '@highfivve/ad-tag/lib/tests/ts/stubs/browserEnvSetup';

// setup sinon-chai
use(sinonChai);

// tslint:disable: no-unused-expression
describe('Prebid Google Analytics Module', () => {
  const config: Moli.MoliConfig = {
    slots: [],
    logger: newNoopLogger(),
    prebid: { config: pbjsTestConfig }
  };

  const sandbox = Sinon.createSandbox();
  let dom = createDom();
  let jsDomWindow: Window = dom.window as any;

  afterEach(() => {
    dom = createDom();
    jsDomWindow = dom.window as any;
    sandbox.reset();
  });

  it('should initialize the global analytics object if not set', () => {
    const module = new PrebidGoogleAnalytics(
      {
        trackingId: 'UA-123456-78',
        options: {
          trackerName: 'h5',
          sampling: 1,
          enableDistribution: true
        }
      },
      jsDomWindow
    );
    const _window = jsDomWindow as any;

    expect(_window.ga).to.be.undefined;
    module.init(config, createAssetLoaderService(jsDomWindow));
    expect(_window.ga).to.be.ok;
  });

  it('should configure the global analytics object if it has another name', () => {
    const module = new PrebidGoogleAnalytics(
      {
        trackingId: 'UA-123456-78',
        options: {
          global: 'myGlobalAnalytics',
          trackerName: 'h5',
          sampling: 1,
          enableDistribution: true
        }
      },
      jsDomWindow
    );
    const _window = jsDomWindow as any;

    expect(_window.myGlobalAnalytics).to.be.undefined;
    module.init(config, createAssetLoaderService(jsDomWindow));
    expect(_window.myGlobalAnalytics).to.be.ok;
  });

  it('should create a new tracker and track a pageview', () => {
    const _window = jsDomWindow as any;
    const gaSpy = sandbox.spy();
    _window.ga = gaSpy;

    const module = new PrebidGoogleAnalytics(
      {
        trackingId: 'UA-123456-78',
        options: {
          trackerName: 'h5',
          sampling: 1,
          enableDistribution: true
        }
      },
      jsDomWindow
    );

    module.init(config, createAssetLoaderService(jsDomWindow));

    expect(gaSpy).to.have.been.calledTwice;
    expect(gaSpy).to.have.been.calledWith('create', 'UA-123456-78', 'auto', 'h5');
    expect(gaSpy).to.have.been.calledWith('h5.send', 'pageview');
  });

  it('should initialize the global pbjs object if not set', () => {
    const module = new PrebidGoogleAnalytics(
      {
        trackingId: 'UA-123456-78',
        options: {
          trackerName: 'h5',
          sampling: 1,
          enableDistribution: true
        }
      },
      jsDomWindow
    );
    const _window = jsDomWindow as any;

    expect(_window.pbjs).to.be.undefined;
    module.init(config, createAssetLoaderService(jsDomWindow));
    expect(_window.pbjs).to.be.ok;
    expect(_window.pbjs.que).to.be.have.lengthOf(1);
  });

  it('should initialize call enableAnalytics', () => {
    const options = {
      trackerName: 'h5',
      sampling: 1,
      enableDistribution: true
    };
    const module = new PrebidGoogleAnalytics(
      {
        trackingId: 'UA-123456-78',
        options: options
      },
      jsDomWindow
    );
    const _window = jsDomWindow as any;

    expect(_window.pbjs).to.be.undefined;
    module.init(config, createAssetLoaderService(jsDomWindow));

    const enableAnalyticsSpy = sandbox.spy();
    _window.pbjs.enableAnalytics = enableAnalyticsSpy;
    expect(_window.pbjs.que).to.be.have.lengthOf(1);
    _window.pbjs.que[0]();

    expect(enableAnalyticsSpy).to.have.been.calledOnceWithExactly([
      {
        provider: 'ga',
        options: options
      }
    ]);
  });
});
// tslint:enable
