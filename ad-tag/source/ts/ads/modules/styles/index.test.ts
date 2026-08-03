import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { createStylesLoader } from './index';
import { createDomAndWindow } from 'ad-tag/stubs/browserEnvSetup';
import { modules } from 'ad-tag/types/moliConfig';
import { newAdPipelineContext } from 'ad-tag/stubs/moliStubs';

use(sinonChai);

describe('styles loader module', () => {
  let sandbox: Sinon.SinonSandbox;
  let jsDomWindow: any;

  beforeEach(() => {
    sandbox = Sinon.createSandbox();
    jsDomWindow = createDomAndWindow().jsDomWindow;
  });

  afterEach(() => {
    sandbox.restore();
  });

  const createAndConfigure = (config: modules.styles.StylesConfig) => {
    const mod = createStylesLoader();
    mod.configure__({ styles: config });
    const steps = mod.initSteps__();
    return { mod, initStep: steps[0], steps };
  };

  it('should not add an init step if not configured', () => {
    const mod = createStylesLoader();
    expect(mod.initSteps__()).to.have.lengthOf(0);
  });

  it('should not add an init step if disabled', () => {
    const { steps } = createAndConfigure({ enabled: false, href: 'https://example.com/style.css' });
    expect(steps).to.have.lengthOf(0);
  });

  it('should add a single init step if enabled', () => {
    const { steps } = createAndConfigure({ enabled: true, href: 'https://example.com/style.css' });
    expect(steps).to.have.lengthOf(1);
    expect(steps[0].name).to.equal('styles-init');
  });

  it('should prepend a stylesheet link as first child of head', async () => {
    const existingHeadChild = jsDomWindow.document.createElement('meta');
    jsDomWindow.document.head.appendChild(existingHeadChild);

    const { initStep } = createAndConfigure({
      enabled: true,
      href: 'https://example.com/style.css'
    });
    await initStep(newAdPipelineContext(jsDomWindow));

    const link = jsDomWindow.document.head.firstElementChild;
    expect(link.tagName).to.equal('LINK');
    expect(link.rel).to.equal('stylesheet');
    expect(link.href).to.equal('https://example.com/style.css');
    expect(jsDomWindow.document.head.children[1]).to.equal(existingHeadChild);
  });

  it('should resolve without waiting for the link to load (fire-and-forget)', async () => {
    // jsdom never fires a `load` event for injected stylesheets, so this only resolves
    // if the init step doesn't await that event - it would otherwise hang and time out.
    const { initStep } = createAndConfigure({
      enabled: true,
      href: 'https://example.com/style.css'
    });
    await initStep(newAdPipelineContext(jsDomWindow));
  });

  it('should log an error via context.logger__ when the link fails to load', async () => {
    const context = newAdPipelineContext(jsDomWindow);
    const errorSpy = sandbox.spy(context.logger__, 'error');

    const { initStep } = createAndConfigure({
      enabled: true,
      href: 'https://example.com/style.css'
    });
    await initStep(context);

    const link = jsDomWindow.document.head.firstElementChild;
    link.dispatchEvent(new jsDomWindow.Event('error'));

    expect(errorSpy).to.have.been.calledWith(
      'styles loader',
      'failed to load stylesheet https://example.com/style.css'
    );
  });
});
