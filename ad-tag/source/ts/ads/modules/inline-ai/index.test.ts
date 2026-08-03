import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';

import { createInlineAi } from './index';
import { createDomAndWindow } from 'ad-tag/stubs/browserEnvSetup';
import { modules } from 'ad-tag/types/moliConfig';
import { newAdPipelineContext } from 'ad-tag/stubs/moliStubs';
import { fullConsent, tcDataNoGdpr } from 'ad-tag/stubs/consentStubs';
import { AssetLoadMethod } from 'ad-tag/util/assetLoaderService';
import { AdPipelineContext } from 'ad-tag/ads/adPipeline';

use(sinonChai);

describe('inline-ai module', () => {
  let sandbox: Sinon.SinonSandbox;
  let jsDomWindow: any;

  beforeEach(() => {
    sandbox = Sinon.createSandbox();
    jsDomWindow = createDomAndWindow().jsDomWindow;
  });

  afterEach(() => {
    sandbox.restore();
  });

  const baseConfig: modules.inlineAi.InlineAiModuleConfig = {
    enabled: true,
    publisherId: 'pub-123',
    mode: 'auto'
  };

  const createAndConfigure = (config: modules.inlineAi.InlineAiModuleConfig) => {
    const mod = createInlineAi();
    mod.configure__({ inlineAi: config });
    const steps = mod.initSteps__();
    return { mod, initStep: steps[0], steps };
  };

  const context = (overrides?: Partial<AdPipelineContext>): AdPipelineContext => ({
    ...newAdPipelineContext(jsDomWindow),
    ...overrides
  });

  it('should not add an init step if not configured', () => {
    const mod = createInlineAi();
    expect(mod.initSteps__()).to.have.lengthOf(0);
  });

  it('should not add an init step if disabled', () => {
    const { steps } = createAndConfigure({ ...baseConfig, enabled: false });
    expect(steps).to.have.lengthOf(0);
  });

  it('should add a single init step if enabled', () => {
    const { steps } = createAndConfigure(baseConfig);
    expect(steps).to.have.lengthOf(1);
    expect(steps[0].name).to.equal('inline-ai-init');
  });

  describe('script loading', () => {
    it('should not load the script in a test environment', async () => {
      const { initStep } = createAndConfigure(baseConfig);
      const ctx = context({ env__: 'test' });
      const spy = sandbox.spy(ctx.assetLoaderService__, 'loadScript');

      await initStep(ctx);

      expect(spy).to.have.not.been.called;
    });

    it('should load the default script url with the publisher id as a query param', async () => {
      const { initStep } = createAndConfigure(baseConfig);
      const ctx = context();
      const spy = sandbox.stub(ctx.assetLoaderService__, 'loadScript').resolves();

      await initStep(ctx);

      expect(spy).to.have.been.calledOnceWithExactly({
        name: 'inline-ai',
        loadMethod: AssetLoadMethod.TAG,
        assetUrl: 'https://getinline.tech/default/assets/index.js?key=pub-123',
        type: 'module'
      });
    });

    it('should use a configured scriptUrl override', async () => {
      const { initStep } = createAndConfigure({
        ...baseConfig,
        scriptUrl: 'https://example.com/custom.js'
      });
      const ctx = context();
      const spy = sandbox.stub(ctx.assetLoaderService__, 'loadScript').resolves();

      await initStep(ctx);

      expect(spy).to.have.been.calledOnceWithExactly({
        name: 'inline-ai',
        loadMethod: AssetLoadMethod.TAG,
        assetUrl: 'https://example.com/custom.js?key=pub-123',
        type: 'module'
      });
    });
  });

  describe('consent gate', () => {
    const testLoad = async (tcData: any, shouldLoad: boolean) => {
      const { initStep } = createAndConfigure(baseConfig);
      const ctx = context({ tcData__: tcData });
      const spy = sandbox.stub(ctx.assetLoaderService__, 'loadScript').resolves();

      await initStep(ctx);

      if (shouldLoad) {
        expect(spy).to.have.been.calledOnce;
      } else {
        expect(spy).to.have.not.been.called;
      }
    };

    it('should load when purpose 1 consent is granted', async () => {
      await testLoad(fullConsent(), true);
    });

    it('should not load when purpose 1 consent is denied', async () => {
      const denied = fullConsent();
      await testLoad(
        {
          ...denied,
          purpose: { ...denied.purpose, consents: { ...denied.purpose.consents, 1: false } }
        },
        false
      );
    });

    it('should not load when purpose 1 consent is unresolved', async () => {
      const unresolved = fullConsent();
      const { 1: _removed, ...rest } = unresolved.purpose.consents;
      await testLoad({ ...unresolved, purpose: { ...unresolved.purpose, consents: rest } }, false);
    });

    it('should load when gdpr does not apply, regardless of purpose consents', async () => {
      await testLoad(tcDataNoGdpr, true);
    });
  });

  describe('auto mode', () => {
    it('never creates the command queue, even with placements configured', async () => {
      const { initStep } = createAndConfigure({
        ...baseConfig,
        mode: 'auto',
        placements: [{ name: 'widget-1', type: 'widget' }]
      });
      const ctx = context();
      sandbox.stub(ctx.assetLoaderService__, 'loadScript').resolves();
      const addLabelSpy = sandbox.spy(ctx.labelConfigService__, 'addLabel');

      await initStep(ctx);

      expect(jsDomWindow.InlineAI).to.be.undefined;
      expect(addLabelSpy).to.have.not.been.called;
    });

    it('still loads the script', async () => {
      const { initStep } = createAndConfigure({ ...baseConfig, mode: 'auto' });
      const ctx = context();
      const spy = sandbox.stub(ctx.assetLoaderService__, 'loadScript').resolves();

      await initStep(ctx);

      expect(spy).to.have.been.calledOnce;
    });
  });

  describe('programmatic mode', () => {
    it('pushes init followed by filtered mount calls, in order', async () => {
      const { initStep } = createAndConfigure({
        ...baseConfig,
        mode: 'programmatic',
        placements: [
          { name: 'widget-1', type: 'widget' },
          {
            name: 'hybrid-only',
            type: 'basic-embed',
            target: 'sidebar',
            labelCondition: { labelAll: ['hybrid'] }
          },
          { name: 'search-1', type: 'search-embed', target: 'search-box' }
        ]
      });
      const ctx = context();
      sandbox.stub(ctx.assetLoaderService__, 'loadScript').resolves();

      await initStep(ctx);

      expect(jsDomWindow.InlineAI.cmd).to.deep.equal([
        ['init', { publisherId: 'pub-123' }],
        ['mount', 'widget'],
        ['mount', 'search-embed', 'search-box']
      ]);
    });

    it('injects the mode as an active label', async () => {
      const { initStep } = createAndConfigure({ ...baseConfig, mode: 'programmatic' });
      const ctx = context();
      sandbox.stub(ctx.assetLoaderService__, 'loadScript').resolves();

      await initStep(ctx);

      expect(ctx.labelConfigService__.getSupportedLabels()).to.include('programmatic');
    });
  });

  describe('hybrid mode', () => {
    it('never pushes init, but pushes filtered mount calls', async () => {
      const { initStep } = createAndConfigure({
        ...baseConfig,
        mode: 'hybrid',
        placements: [
          {
            name: 'programmatic-only',
            type: 'basic-embed',
            target: 'sidebar',
            labelCondition: { labelAll: ['programmatic'] }
          },
          { name: 'widget-1', type: 'widget' }
        ]
      });
      const ctx = context();
      sandbox.stub(ctx.assetLoaderService__, 'loadScript').resolves();

      await initStep(ctx);

      expect(jsDomWindow.InlineAI.cmd).to.deep.equal([['mount', 'widget']]);
    });

    it('injects the mode as an active label', async () => {
      const { initStep } = createAndConfigure({ ...baseConfig, mode: 'hybrid' });
      const ctx = context();
      sandbox.stub(ctx.assetLoaderService__, 'loadScript').resolves();

      await initStep(ctx);

      expect(ctx.labelConfigService__.getSupportedLabels()).to.include('hybrid');
    });
  });

  describe('mount command shapes per placement type', () => {
    const mountedCommands = async (
      placements: modules.inlineAi.InlineAiPlacementConfig[]
    ): Promise<unknown[]> => {
      const { initStep } = createAndConfigure({
        ...baseConfig,
        mode: 'programmatic',
        placements
      });
      const ctx = context();
      sandbox.stub(ctx.assetLoaderService__, 'loadScript').resolves();

      await initStep(ctx);

      // drop the leading `init` command
      return jsDomWindow.InlineAI.cmd.slice(1);
    };

    it('widget: no target, no options', async () => {
      const cmds = await mountedCommands([{ name: 'w', type: 'widget' }]);
      expect(cmds).to.deep.equal([['mount', 'widget']]);
    });

    it('search-fab: without options', async () => {
      const cmds = await mountedCommands([{ name: 'fab', type: 'search-fab' }]);
      expect(cmds).to.deep.equal([['mount', 'search-fab']]);
    });

    it('search-fab: with options, undefined target placeholder', async () => {
      const cmds = await mountedCommands([
        {
          name: 'fab',
          type: 'search-fab',
          options: {
            fabPosition: { horizontalPosition: 'right', rightOffset: '20px' },
            shape: 'pill'
          }
        }
      ]);
      expect(cmds).to.deep.equal([
        [
          'mount',
          'search-fab',
          undefined,
          {
            fabPosition: { horizontalPosition: 'right', rightOffset: '20px' },
            shape: 'pill'
          }
        ]
      ]);
    });

    it('search-embed: target + options', async () => {
      const cmds = await mountedCommands([
        {
          name: 'search',
          type: 'search-embed',
          target: 'search-box',
          options: { placeholder: 'Ask a question...' }
        }
      ]);
      expect(cmds).to.deep.equal([
        ['mount', 'search-embed', 'search-box', { placeholder: 'Ask a question...' }]
      ]);
    });

    it('search-icon: target only', async () => {
      const cmds = await mountedCommands([
        { name: 'icon', type: 'search-icon', target: 'nav-search' }
      ]);
      expect(cmds).to.deep.equal([['mount', 'search-icon', 'nav-search']]);
    });

    it('key-takeaways: object target with positioning fields', async () => {
      const cmds = await mountedCommands([
        {
          name: 'kt',
          type: 'key-takeaways',
          target: { selector: '.article-sidebar', location: 'prepend', maxWidth: '400px' }
        }
      ]);
      expect(cmds).to.deep.equal([
        [
          'mount',
          'key-takeaways',
          { selector: '.article-sidebar', location: 'prepend', maxWidth: '400px' }
        ]
      ]);
    });

    it('single-question: target with injection fields', async () => {
      const cmds = await mountedCommands([
        {
          name: 'sq',
          type: 'single-question',
          target: {
            dynamic: { tagName: 'article' },
            injectionLimit: 3,
            injectionStrategy: 'distribute-evenly'
          }
        }
      ]);
      expect(cmds).to.deep.equal([
        [
          'mount',
          'single-question',
          {
            dynamic: { tagName: 'article' },
            injectionLimit: 3,
            injectionStrategy: 'distribute-evenly'
          }
        ]
      ]);
    });

    it('basic-embed: string target shorthand', async () => {
      const cmds = await mountedCommands([
        { name: 'be', type: 'basic-embed', target: 'content-sidebar' }
      ]);
      expect(cmds).to.deep.equal([['mount', 'basic-embed', 'content-sidebar']]);
    });
  });
});
