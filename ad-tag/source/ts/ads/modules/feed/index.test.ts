import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';

import { feedModule } from './index';
import { createDomAndWindow } from 'ad-tag/stubs/browserEnvSetup';
import { modules } from 'ad-tag/types/moliConfig';
import { adPipelineContext } from 'ad-tag/stubs/adPipelineContextStubs';
import { AdPipelineContext } from 'ad-tag/ads/adPipeline';

use(sinonChai);

describe('feedModule', () => {
  const sandbox = Sinon.createSandbox();

  let jsDomWindow: Window;

  const createAndConfigureModule = (feedConfig?: modules.feed.FeedConfig) => {
    const mod = feedModule();
    mod.configure__({ feed: feedConfig } as any);
    return mod;
  };

  const runInitSteps = async (mod: ReturnType<typeof feedModule>, ctx: AdPipelineContext) => {
    const [initStep] = mod.initSteps__();
    await initStep(ctx);
    // wait for any async operations to complete
    await new Promise(resolve => setTimeout(resolve, 5));
  };

  const feedOption: modules.feed.FeedOptions = {
    selector: '.feed',
    feedId: '123',
    feedUrl: 'https://api.example.com/feed'
  };

  const feedConfig: modules.feed.FeedConfig = {
    enabled: true,
    feeds: [feedOption]
  };

  beforeEach(() => {
    jsDomWindow = createDomAndWindow().jsDomWindow;
    sandbox.restore();
  });

  afterEach(() => {
    sandbox.reset();
  });

  after(() => {
    sandbox.restore();
  });

  it('should not return any steps if not configured', () => {
    const mod = feedModule();
    expect(mod.initSteps__()).to.be.empty;
    expect(mod.configureSteps__()).to.be.empty;
    expect(mod.prepareRequestAdsSteps__()).to.be.empty;
  });

  it('should not return any steps if disabled', () => {
    const mod = feedModule();
    mod.configure__({ feed: { enabled: false, feeds: [] } as any });
    expect(mod.initSteps__()).to.be.empty;
  });

  it('should return an init step if enabled', () => {
    const mod = createAndConfigureModule(feedConfig);
    expect(mod.initSteps__()).to.have.lengthOf(1);
  });

  it('should inject HTML and reinsert scripts for a feed', async () => {
    const mod = createAndConfigureModule(feedConfig);

    // Setup DOM
    const el = jsDomWindow.document.createElement('div');
    el.className = 'feed';
    el.id = 'feed1';
    jsDomWindow.document.body.appendChild(el);

    // Mock fetch
    const htmlWithScript = '<div>content</div><script>window.__test = 42;</script>';
    const fetchStub = sandbox.stub(jsDomWindow, 'fetch').resolves({
      ok: true,
      text: async () => htmlWithScript
    } as any);

    await runInitSteps(mod, adPipelineContext(jsDomWindow));
    expect(fetchStub).to.have.been.calledOnce;
    expect(el.innerHTML).to.contain('content');
    // The script should be reinserted as a new script element
    const scripts = el.querySelectorAll('script');
    expect(scripts).to.have.lengthOf(1);
    expect(scripts[0].textContent).to.equal('window.__test = 42;');
  });

  it('should pass keywords as query parameters', async () => {
    const feedConfigWithKeywords: modules.feed.FeedConfig = {
      enabled: true,
      feeds: [
        {
          ...feedOption,
          keywords: ['sports', 'news']
        }
      ]
    };
    const mod = createAndConfigureModule(feedConfigWithKeywords);

    const el = jsDomWindow.document.createElement('div');
    el.className = 'feed';
    jsDomWindow.document.body.appendChild(el);

    const fetchStub = sandbox.stub(jsDomWindow, 'fetch').resolves({
      ok: true,
      text: async () => '<div>content</div>'
    } as any);

    await runInitSteps(mod, adPipelineContext(jsDomWindow));

    expect(fetchStub).to.have.been.calledOnce;
    const calledUrl = new URL(fetchStub.firstCall.args[0] as string);
    expect(calledUrl.searchParams.get('keywords')).to.equal(encodeURIComponent('sports;news'));
  });

  it('should log a warning if no content is received', async () => {
    const mod = createAndConfigureModule(feedConfig);

    const el = jsDomWindow.document.createElement('div');
    el.className = 'feed';
    jsDomWindow.document.body.appendChild(el);

    const fetchStub = sandbox.stub(jsDomWindow, 'fetch').resolves({
      ok: false,
      status: 404,
      text: async () => ''
    } as any);

    const ctx = adPipelineContext(jsDomWindow);
    const warnSpy = sandbox.spy(ctx.logger__, 'warn');
    await runInitSteps(mod, ctx);

    expect(fetchStub).to.have.been.calledOnce;
    expect(warnSpy).to.have.been.calledWith('feed', 'No content received from API');
  });

  it('should handle fetch errors gracefully', async () => {
    const mod = createAndConfigureModule(feedConfig);

    const el = jsDomWindow.document.createElement('div');
    el.className = 'feed';
    jsDomWindow.document.body.appendChild(el);

    const ctx = adPipelineContext(jsDomWindow);
    const fetchStub = sandbox.stub(jsDomWindow, 'fetch').rejects(new Error('fail'));
    const errorSpy = sandbox.spy(ctx.logger__, 'error');
    await runInitSteps(mod, ctx);

    expect(fetchStub).to.have.been.calledOnce;
    expect(errorSpy).to.have.been.calledWith('feed', 'Error fetching content:', Sinon.match.any);
  });
});
