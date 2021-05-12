import { createDom } from '@highfivve/ad-tag/lib/stubs/browserEnvSetup';
import { expect, use } from 'chai';
import sinonChai from 'sinon-chai';
import * as Sinon from 'sinon';
import { YieldOptimizationService } from './yieldOptimizationService';
import { noopLogger } from '@highfivve/ad-tag/lib/stubs/moliStubs';
import { googleAdSlotStub } from '@highfivve/ad-tag/lib/stubs/googletagStubs';
import {
  AdunitPriceRulesResponse,
  DynamicYieldOptimizationConfig,
  NoYieldOptimizationConfig,
  StaticYieldOptimizationConfig,
  YieldOptimizationConfig
} from './index';

// setup sinon-chai
use(sinonChai);

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
    const config: NoYieldOptimizationConfig = { provider: 'none' };
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
      const config: StaticYieldOptimizationConfig = { provider: 'static', config: { rules: {} } };
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
      const config: StaticYieldOptimizationConfig = {
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
    const adUnit1 = 'ad_content_1';
    const adUnit2 = 'ad_content_2';
    const config: DynamicYieldOptimizationConfig = {
      provider: 'dynamic',
      configEndpoint: '//localhost'
    };

    const publisherYieldConfiguration: AdunitPriceRulesResponse = {
      rules: {
        [adUnit1]: {
          priceRuleId: 3,
          floorprice: 0.2,
          main: true
        },
        [adUnit2]: {
          priceRuleId: 4,
          floorprice: 0.3,
          model: 'ml',
          main: false
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

        const rule = await service.getPriceRule(adUnit1);
        expect(rule).not.to.be.undefined;
        expect(fetchStub).to.have.been.calledThrice;
      });

      it('should always return undefined if the asset loading fails after 3 retries', async () => {
        fetchStub.rejects('FetchRequestFailed');
        const service = createService(config);

        await service.init([]);
        const rule = await service.getPriceRule(adUnit1);
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

        const rule = await service.getPriceRule(adUnit1);
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

        const rule = await service.getPriceRule(adUnit1);
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
        const adSlot = googleAdSlotStub('/123/publisher/p_content_1', adUnit1);

        await service.init([]);
        await service.getPriceRule(adUnit1);
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
        const rule = await service.getPriceRule(adUnit1);
        expect(rule).to.be.ok;
        expect(rule!.main).to.be.true;
        expect(rule!.priceRuleId).to.be.eq(3);
        expect(rule!.floorprice).to.be.eq(0.2);
        expect(rule!.main).to.be.eq(true);
      });

      describe('setTargeting', async () => {
        it('should setTargeting with model fallback', async () => {
          const adSlot = googleAdSlotStub('/123/publisher/p_content_1', adUnit1);
          const setTargetingSpy = sandbox.spy(adSlot, 'setTargeting');

          const service = createService(config);
          await service.init([]);
          const rule = await service.getPriceRule(adUnit1);
          await service.setTargeting(adSlot);

          expect(setTargetingSpy).has.been.calledWith('upr_id', rule!.priceRuleId.toFixed(0));
          expect(setTargetingSpy).has.been.calledWith('upr_model', 'static');
          expect(setTargetingSpy).has.been.calledWith('upr_main', `${rule!.main}`);
        });

        it('should setTargeting with model', async () => {
          const adSlot = googleAdSlotStub('/123/publisher/p_content_1', adUnit2);
          const setTargetingSpy = sandbox.spy(adSlot, 'setTargeting');

          const service = createService(config);
          await service.init([]);
          await service.setTargeting(adSlot);

          expect(setTargetingSpy).has.been.calledWith('upr_model', 'ml');
        });
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
          const adSlot = googleAdSlotStub('/123/publisher/p_content_1', adUnit1);

          await service.init(labels);
          await service.getPriceRule(adUnit1);
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
