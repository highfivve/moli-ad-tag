import { expect, use } from 'chai';
import * as Sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { customModule } from './index';
import { AdPipelineContext } from 'ad-tag/ads/adPipeline';
import { createDomAndWindow } from 'ad-tag/stubs/browserEnvSetup';
import { modules } from 'ad-tag/types/moliConfig';
import { newAdPipelineContext } from 'ad-tag/stubs/moliStubs';
import { createLabelConfigService } from 'ad-tag/ads/labelConfigService';
import { fullConsent, tcData, tcDataNoGdpr } from 'ad-tag/stubs/consentStubs';

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

  describe('inline JS injection', () => {
    it('should inject inline JS code on init if enabled', async () => {
      const appendChildSpy = sandbox.spy(jsDomWindow.document.head, 'appendChild');
      const context = newAdPipelineContext(jsDomWindow);
      const infoSpy = sandbox.spy(context.logger__, 'info');
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
      const context = newAdPipelineContext(jsDomWindow);
      const errorSpy = sandbox.spy(context.logger__, 'error');
      const config = {
        enabled: true,
        inlineJs: { code: 'window.testInjected = true;' }
      };
      const { initStep, steps } = createAndConfigureCustomModule(config);
      await initStep(context);
      expect(appendChildStub).to.have.been.called;
      expect(errorSpy).to.have.been.calledWithMatch(
        'custom',
        'Failed to inject inline JS',
        Sinon.match.instanceOf(Error)
      );
    });
  });

  describe('custom scripts loading', () => {
    it('should not add any scripts if none are configured', async () => {
      const context = newAdPipelineContext(jsDomWindow);
      const config = {
        enabled: true,
        scripts: []
      };
      const { initStep } = createAndConfigureCustomModule(config);
      await initStep(context);
      const scripts = jsDomWindow.document.getElementsByTagName('script');
      expect(scripts).to.have.lengthOf(0);
    });

    it('should create a script from the given configuration', async () => {
      const context = newAdPipelineContext(jsDomWindow);
      const config = {
        enabled: true,
        scripts: [
          {
            src: 'https://example.com/test.js',
            attributes: { async: 'true', 'data-test': '123' }
          }
        ]
      };
      const { initStep } = createAndConfigureCustomModule(config);
      await initStep(context);
      const scripts = jsDomWindow.document.getElementsByTagName('script');
      expect(scripts).to.have.lengthOf(1);
      const script: HTMLScriptElement = scripts[0];
      expect(script.src).to.equal('https://example.com/test.js');
      // default type attribute
      expect(script.getAttribute('type')).to.equal('text/javascript');
      // custom attributes
      expect(script.getAttribute('async')).to.equal('true');
      expect(script.getAttribute('data-test')).to.equal('123');
    });
  });

  it('should only inject scripts that pass the label filter', async () => {
    const labelConfigService = createLabelConfigService([], ['foo'], jsDomWindow);
    const context: AdPipelineContext = {
      ...newAdPipelineContext(jsDomWindow),
      labelConfigService__: labelConfigService
    };
    const config = {
      enabled: true,
      scripts: [
        { src: 'https://example.com/allowed1.js', labelAll: ['foo'] },
        { src: 'https://example.com/allowed2.js', labelAny: ['foo'] },
        { src: 'https://example.com/blocked.js', labelAll: ['bar'] }
      ]
    };
    const { initStep } = createAndConfigureCustomModule(config);
    await initStep(context);
    const scripts = jsDomWindow.document.getElementsByTagName('script');
    expect(scripts).to.have.lengthOf(2);
    expect(scripts[0].src).to.equal('https://example.com/allowed1.js');
    expect(scripts[1].src).to.equal('https://example.com/allowed2.js');
  });

  describe('consent checks', () => {
    const vendorId = '123';
    const configWithConsent: modules.custom.CustomModuleConfig = {
      enabled: true,
      scripts: [{ src: 'https://example.com/test.js', consent: { cmpApi: 'tcf', vendorId } }]
    };

    it('should inject script if no consent config is provided', async () => {
      const context = newAdPipelineContext(jsDomWindow);
      const config: modules.custom.CustomModuleConfig = {
        enabled: true,
        scripts: [{ src: 'https://example.com/test.js' }]
      };
      const { initStep } = createAndConfigureCustomModule(config);
      await initStep(context);
      const scripts = jsDomWindow.document.getElementsByTagName('script');
      expect(scripts).to.have.lengthOf(1);
      expect(scripts[0].src).to.equal('https://example.com/test.js');
    });

    it('should inject script if in test mode regardless of consent', async () => {
      const context: AdPipelineContext = { ...newAdPipelineContext(jsDomWindow), env__: 'test' };
      const { initStep } = createAndConfigureCustomModule(configWithConsent);
      await initStep(context);
      const scripts = jsDomWindow.document.getElementsByTagName('script');
      expect(scripts).to.have.lengthOf(1);
      expect(scripts[0].src).to.equal('https://example.com/test.js');
    });

    it('should inject script if TCF consent is given', async () => {
      const context: AdPipelineContext = {
        ...newAdPipelineContext(jsDomWindow),
        tcData__: fullConsent({ [vendorId]: true })
      };
      const { initStep } = createAndConfigureCustomModule(configWithConsent);
      await initStep(context);
      const scripts = jsDomWindow.document.getElementsByTagName('script');
      expect(scripts).to.have.lengthOf(1);
      expect(scripts[0].src).to.equal('https://example.com/test.js');
    });

    it('should not inject script if TCF consent is denied', async () => {
      const context: AdPipelineContext = {
        ...newAdPipelineContext(jsDomWindow),
        tcData__: fullConsent({ [vendorId]: false })
      };
      const { initStep } = createAndConfigureCustomModule(configWithConsent);
      await initStep(context);
      const scripts = jsDomWindow.document.getElementsByTagName('script');
      expect(scripts).to.have.lengthOf(0);
    });

    it('should inject script if gdprApplies is false', async () => {
      const context: AdPipelineContext = {
        ...newAdPipelineContext(jsDomWindow),
        tcData__: tcDataNoGdpr
      };
      const { initStep } = createAndConfigureCustomModule(configWithConsent);
      await initStep(context);
      const scripts = jsDomWindow.document.getElementsByTagName('script');
      expect(scripts).to.have.lengthOf(1);
      expect(scripts[0].src).to.equal('https://example.com/test.js');
    });
  });
});
