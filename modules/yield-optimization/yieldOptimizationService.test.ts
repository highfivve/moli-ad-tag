import { createDom } from '@highfivve/ad-tag/tests/ts/stubs/browserEnvSetup';
import { expect, use } from 'chai';
import sinonChai from 'sinon-chai';
import * as Sinon from 'sinon';
import { YieldOptimizationService } from './yieldOptimizationService';
import { noopLogger } from '@highfivve/ad-tag/tests/ts/stubs/moliStubs';
import { googleAdSlotStub } from '@highfivve/ad-tag/tests/ts/stubs/googletagStubs';
import {
  IAdunitPriceRulesResponse,
  IDynamicYieldOptimizationConfig,
  INoYieldOptimizationConfig,
  IStaticYieldOptimizationConfig,
  YieldOptimizationConfig
} from './index';

// setup sinon-chai
use(sinonChai);

// tslint:disable: no-unused-expression
describe('YieldOptimizationService', () => {
  const dom = createDom();
  const domWindow: Window = dom.window as any;
  domWindow.fetch = () => {
    return Promise.reject('not implemented');
  };

  // single sandbox instance to create spies and stubs
  const sandbox = Sinon.createSandbox();
  const fetchStub = sandbox.stub(dom.window, 'fetch');

  const createService = (config: YieldOptimizationConfig): YieldOptimizationService => {
    return new YieldOptimizationService(config, noopLogger, domWindow);
  };

  afterEach(() => {
    sandbox.reset();
  });

  describe('provider: none', () => {
    const config: INoYieldOptimizationConfig = { provider: 'none' };
    const service = createService(config);

    it('should always return undefined', async () => {
      await service.init([]);
      const rule = await service.getPriceRule('foo');
      expect(rule).to.be.undefined;
    });

    it('should not set any key-values', async () => {
      const adSlot = googleAdSlotStub('/123/publisher/p_content_1', 'ad_content_1');
      const getSlotElementIdSpy = sandbox.spy(adSlot, 'getSlotElementId');
      const setTargetingSpy = sandbox.spy(adSlot, 'setTargeting');

      await service.init([]);
      await service.setTargeting(adSlot);
      expect(getSlotElementIdSpy).to.have.been.calledOnce;
      expect(setTargetingSpy).to.not.have.been.called;
    });
  });

  describe('provider: static', () => {
    describe('empty config', () => {
      const config: IStaticYieldOptimizationConfig = { provider: 'static', config: { rules: {} } };
      const service = createService(config);

      it('should always return undefined', async () => {
        await service.init([]);
        const rule = await service.getPriceRule('foo');
        expect(rule).to.be.undefined;
      });

      it('should not set any key-values', async () => {
        const adSlot = googleAdSlotStub('/123/publisher/p_content_1', 'ad_content_1');
        const getSlotElementIdSpy = sandbox.spy(adSlot, 'getSlotElementId');
        const setTargetingSpy = sandbox.spy(adSlot, 'setTargeting');

        await service.init([]);
        await service.setTargeting(adSlot);
        expect(getSlotElementIdSpy).to.have.been.calledOnce;
        expect(setTargetingSpy).to.not.have.been.called;
      });
    });

    describe('non empty config', () => {
      const adUnit = 'ad_content_1';
      const config: IStaticYieldOptimizationConfig = {
        provider: 'static',
        config: {
          rules: {
            [adUnit]: {
              priceRuleId: 3,
              floorprice: 0.2,
              main: true
            }
          }
        }
      };

      it('should return undefined if the ad slot is not configured', async () => {
        const service = createService(config);
        await service.init([]);
        const rule = await service.getPriceRule('foo');
        expect(rule).to.be.undefined;
      });

      it('should return the price rule', async () => {
        const service = createService(config);
        await service.init([]);
        const rule = await service.getPriceRule(adUnit);
        expect(rule).to.be.ok;
        expect(rule!.main).to.be.true;
        expect(rule!.priceRuleId).to.be.eq(3);
        expect(rule!.floorprice).to.be.eq(0.2);
        expect(rule!.main).to.be.eq(true);
      });
    });
  });

  describe('provider: dynamic', () => {
    const adUnit = 'ad_content_1';
    const config: IDynamicYieldOptimizationConfig = {
      provider: 'dynamic',
      configEndpoint: '//localhost'
    };

    const publisherYieldConfiguration: IAdunitPriceRulesResponse = {
      rules: {
        [adUnit]: {
          priceRuleId: 3,
          floorprice: 0.2,
          main: true
        }
      }
    };

    describe('error handling', () => {
      it('should retry three times', async () => {
        fetchStub.onFirstCall().rejects('FetchRequestFailed');
        fetchStub.onSecondCall().rejects('FetchRequestFailed');
        fetchStub.onThirdCall().resolves({
          ok: true,
          json: (): Promise<any> => {
            return Promise.resolve(publisherYieldConfiguration);
          }
        } as any);
        const service = createService(config);
        await service.init([]);

        const rule = await service.getPriceRule(adUnit);
        expect(rule).not.to.be.undefined;
        expect(fetchStub).to.have.been.calledThrice;
      });

      it('should always return undefined if the asset loading fails after 3 retries', async () => {
        fetchStub.rejects('FetchRequestFailed');
        const service = createService(config);

        await service.init([]);
        const rule = await service.getPriceRule(adUnit);
        expect(rule).to.be.undefined;
        expect(fetchStub).to.have.been.calledThrice;
      });

      it('should always return undefined if the response is not json', async () => {
        fetchStub.resolves({
          ok: true,
          json: (): Promise<any> => {
            return Promise.resolve('not json');
          }
        } as any);
        const service = createService(config);
        await service.init([]);

        const rule = await service.getPriceRule(adUnit);
        expect(rule).to.be.undefined;
        expect(fetchStub).to.have.been.called;
      });

      it('should always return undefined if the config json has the wrong format', async () => {
        fetchStub.resolves({
          ok: true,
          json: (): Promise<any> => {
            return Promise.resolve({ foo: [] });
          }
        } as any);
        const service = createService(config);
        await service.init([]);

        const rule = await service.getPriceRule(adUnit);
        expect(rule).to.be.undefined;
        expect(fetchStub).to.have.been.called;
      });
    });

    describe('non empty config', () => {
      beforeEach(() => {
        fetchStub.resolves({
          ok: true,
          json: (): Promise<any> => {
            return Promise.resolve(publisherYieldConfiguration);
          }
        } as any);
      });

      it('should call the configured endpoint only once', async () => {
        const service = createService(config);
        const adSlot = googleAdSlotStub('/123/publisher/p_content_1', adUnit);

        await service.init([]);
        await service.getPriceRule(adUnit);
        await service.setTargeting(adSlot);

        expect(fetchStub).to.have.been.calledOnce;
        expect(fetchStub).to.have.been.calledOnceWithExactly(config.configEndpoint, {
          body: '{"device":"mobile"}',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          method: 'POST',
          mode: 'cors'
        });
      });

      it('should return undefined if the ad slot is not configured', async () => {
        const service = createService(config);
        await service.init([]);
        const rule = await service.getPriceRule('foo');
        expect(rule).to.be.undefined;
      });

      it('should return the price rule', async () => {
        const service = createService(config);
        await service.init([]);
        const rule = await service.getPriceRule(adUnit);
        expect(rule).to.be.ok;
        expect(rule!.main).to.be.true;
        expect(rule!.priceRuleId).to.be.eq(3);
        expect(rule!.floorprice).to.be.eq(0.2);
        expect(rule!.main).to.be.eq(true);
      });
    });

    describe('init', () => {
      beforeEach(() => {
        fetchStub.resolves({
          ok: true,
          json: (): Promise<any> => {
            return Promise.resolve(publisherYieldConfiguration);
          }
        } as any);
      });

      // input parameters
      [
        { labels: [], label: 'mobile' },
        { labels: ['mobile'], label: 'mobile' },
        { labels: ['mobile', 'desktop'], label: 'desktop' },
        { labels: ['desktop'], label: 'desktop' }
      ].forEach(({ labels, label }) => {
        it(`should use ${label} with input [${labels.join(',')}]`, async () => {
          const service = createService(config);
          const adSlot = googleAdSlotStub('/123/publisher/p_content_1', adUnit);

          await service.init(labels);
          await service.getPriceRule(adUnit);
          await service.setTargeting(adSlot);

          expect(fetchStub).to.have.been.calledOnce;
          expect(fetchStub).to.have.been.calledOnceWithExactly(config.configEndpoint, {
            body: `{"device":"${label}"}`,
            headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
            method: 'POST',
            mode: 'cors'
          });
        });
      });
    });
  });
});
// tslint:enable
