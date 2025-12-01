import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { customModule } from './index';
import { AdPipelineContext } from 'ad-tag/ads/adPipeline';
import { createDomAndWindow } from 'ad-tag/stubs/browserEnvSetup';
import { modules } from 'ad-tag/types/moliConfig';

use(sinonChai);

describe('customModule', () => {
  let sandbox: Sinon.SinonSandbox;
  let jsDomWindow: any;

  beforeEach(() => {
    sandbox = Sinon.createSandbox();
    jsDomWindow = createDomAndWindow().jsDomWindow;
  });

  afterEach(() => {
    sandbox.restore();
  });

  function createAndConfigureCustomModule(config: modules.custom.CustomModuleConfig) {
    const mod = customModule();
    mod.configure__({ custom: config });
    const steps = mod.initSteps__();
    return { mod, initStep: steps[0], steps };
  }

  function createContext(jsDomWindow: any, loggerSpies?: any): AdPipelineContext {
    return {
      window__: jsDomWindow,
      logger__: loggerSpies || {
        info: sandbox.spy(),
        warn: sandbox.spy(),
        error: sandbox.spy()
      },
      env__: 'prod'
    } as any;
  }

  it('should inject inline JS code on init if enabled', async () => {
    const appendChildSpy = sandbox.spy(jsDomWindow.document.head, 'appendChild');
    const infoSpy = sandbox.spy();
    const context = createContext(jsDomWindow, {
      info: infoSpy,
      warn: sandbox.spy(),
      error: sandbox.spy()
    });
    const config = {
      enabled: true,
      inlineJs: { code: 'window.testInjected = true;' }
    };
    const { initStep, steps } = createAndConfigureCustomModule(config);
    expect(steps).to.have.lengthOf(1);
    await initStep(context);
    expect(appendChildSpy).to.have.been.called;
    expect(infoSpy).to.have.been.calledWith('custom', 'Injected inline JS');
  });

  it('should not add init step if enabled is false', () => {
    const config = {
      enabled: false,
      inlineJs: { code: 'window.testInjected = true;' }
    };
    const { steps } = createAndConfigureCustomModule(config);
    expect(steps).to.have.lengthOf(0);
  });

  it('should warn if no inline JS code is provided', async () => {
    const warnSpy = sandbox.spy();
    const context = createContext(jsDomWindow, {
      info: sandbox.spy(),
      warn: warnSpy,
      error: sandbox.spy()
    });
    const config = {
      enabled: true
    };
    const { initStep, steps } = createAndConfigureCustomModule(config);
    expect(steps).to.have.lengthOf(1);
    await initStep(context);
    expect(warnSpy).to.have.been.calledWith('custom', 'No inline JS code provided');
  });

  it('should do nothing if not configured', () => {
    const mod = customModule();
    mod.configure__({});
    const steps = mod.initSteps__();
    expect(steps).to.have.lengthOf(0);
  });

  it('should handle script injection errors gracefully', async () => {
    const appendChildStub = sandbox
      .stub(jsDomWindow.document.head, 'appendChild')
      .throws(new Error('fail'));
    const errorSpy = sandbox.spy();
    const context = createContext(jsDomWindow, {
      info: sandbox.spy(),
      warn: sandbox.spy(),
      error: errorSpy
    });
    const config = {
      enabled: true,
      inlineJs: { code: 'window.testInjected = true;' }
    };
    const { initStep, steps } = createAndConfigureCustomModule(config);
    await initStep(context);
    expect(errorSpy).to.have.been.calledWithMatch(
      'custom',
      'Failed to inject inline JS',
      Sinon.match.instanceOf(Error)
    );
  });
});
