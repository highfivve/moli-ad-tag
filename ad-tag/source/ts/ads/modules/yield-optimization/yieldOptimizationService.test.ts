import { createDomAndWindow } from 'ad-tag/stubs/browserEnvSetup';
import { expect, use } from 'chai';
import sinonChai from 'sinon-chai';
import * as Sinon from 'sinon';
import { YieldOptimizationService } from './yieldOptimizationService';
import { auction, Device, modules } from 'ad-tag/types/moliConfig';
import { noopLogger } from 'ad-tag/stubs/moliStubs';
import { googleAdSlotStub } from 'ad-tag/stubs/googletagStubs';
import { createGlobalAuctionContext, GlobalAuctionContext } from 'ad-tag/ads/globalAuctionContext';
import { createEventService } from 'ad-tag/ads/eventService';
import StaticYieldOptimizationConfig = modules.yield_optimization.StaticYieldOptimizationConfig;
import NoYieldOptimizationConfig = modules.yield_optimization.NoYieldOptimizationConfig;
import DynamicYieldOptimizationConfig = modules.yield_optimization.DynamicYieldOptimizationConfig;
import AdunitPriceRulesResponse = modules.yield_optimization.AdunitPriceRulesResponse;

// setup sinon-chai
use(sinonChai);

describe('YieldOptimizationService', () => {
  const { jsDomWindow } = createDomAndWindow();
  jsDomWindow.fetch = () => {
    return Promise.reject('not implemented');
  };

  // single sandbox instance to create spies and stubs
  const sandbox = Sinon.createSandbox();
  const fetchStub = sandbox.stub(jsDomWindow, 'fetch');

  const createService = (
    config: modules.yield_optimization.YieldOptimizationConfig
  ): YieldOptimizationService => {
    return new YieldOptimizationService(config);
  };

  afterEach(() => {
    sandbox.reset();
  });

  describe('resolve ad unit paths', () => {
    const adInfo: { device: Device; domain: string }[] = [
      { device: 'mobile', domain: 'example.com' },
      { device: 'desktop', domain: 'test.org' },
      { device: 'mobile', domain: 'acme.net' }
    ];

    adInfo.forEach(({ device, domain }) => {
      it(`should resolve the ad unit path with device: ${device}, domain: ${domain}`, async () => {
        const adUnitDynamic = '/123/pub/ad_content_1/{device}/{domain}';
        const adUnitResolved = `/123/pub/ad_content_1/${device}/${domain}`;
        const config: StaticYieldOptimizationConfig = {
          enabled: true,
          provider: 'static',
          config: {
            rules: {
              [adUnitResolved]: {
                priceRuleId: 3,
                floorprice: 0.2,
                main: true
              }
            }
          }
        };
        const service = createService(config);
        await service.init(
          device,
          { device: device, domain: domain },
          [],
          jsDomWindow.fetch,
          noopLogger
        );
        const rule = await service.getPriceRule(adUnitDynamic);
        expect(rule).to.be.ok;
        expect(rule!.main).to.be.true;
      });
    });
  });

  describe('provider: none', () => {
    const config: NoYieldOptimizationConfig = { enabled: true, provider: 'none' };
    const service = createService(config);

    it('should always return undefined', async () => {
      await service.init('mobile', {}, [], jsDomWindow.fetch, noopLogger);
      const rule = await service.getPriceRule('foo');
      expect(rule).to.be.undefined;
    });

    it('should not set any key-values', async () => {
      const adSlot = googleAdSlotStub('/123/publisher/p_content_1', 'ad_content_1');
      const getAdUnitPathSpy = sandbox.spy(adSlot, 'getAdUnitPath');
      const setTargetingSpy = sandbox.spy(adSlot, 'setTargeting');

      await service.init('mobile', {}, [], jsDomWindow.fetch, noopLogger);
      await service.setTargeting(adSlot, 'gam', noopLogger, config);
      expect(getAdUnitPathSpy).to.have.been.calledOnce;
      expect(setTargetingSpy).to.not.have.been.called;
    });
  });

  describe('provider: static', () => {
    describe('empty config', () => {
      const config: StaticYieldOptimizationConfig = {
        enabled: true,
        provider: 'static',
        config: { rules: {} }
      };
      const service = createService(config);

      it('should always return undefined', async () => {
        await service.init('mobile', {}, [], jsDomWindow.fetch, noopLogger);
        const rule = await service.getPriceRule('foo');
        expect(rule).to.be.undefined;
      });

      it('should not set any key-values', async () => {
        const adSlot = googleAdSlotStub('/123/publisher/p_content_1', 'ad_content_1');
        const getAdUnitPathSpy = sandbox.spy(adSlot, 'getAdUnitPath');
        const setTargetingSpy = sandbox.spy(adSlot, 'setTargeting');

        await service.init('mobile', {}, [], jsDomWindow.fetch, noopLogger);
        await service.setTargeting(adSlot, 'gam', noopLogger, config);
        expect(getAdUnitPathSpy).to.have.been.calledOnce;
        expect(setTargetingSpy).to.not.have.been.called;
      });
    });

    describe('non empty config', () => {
      const adUnit = 'ad_content_1';
      const config: StaticYieldOptimizationConfig = {
        enabled: true,
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
        await service.init('mobile', {}, [], jsDomWindow.fetch, noopLogger);
        const rule = await service.getPriceRule('foo');
        expect(rule).to.be.undefined;
      });

      it('should return the price rule', async () => {
        const service = createService(config);
        await service.init('mobile', {}, [], jsDomWindow.fetch, noopLogger);
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
    const adUnitPath1 = '/123/publisher/p_content_1';
    const adUnitPath2 = '/123/publisher/p_content_2';
    const config: DynamicYieldOptimizationConfig = {
      enabled: true,
      provider: 'dynamic',
      configEndpoint: '//localhost',
      excludedAdUnitPaths: []
    };

    const publisherYieldConfiguration: AdunitPriceRulesResponse = {
      rules: {
        [adUnitPath1]: {
          priceRuleId: 3,
          floorprice: 0.2,
          main: true
        },
        [adUnitPath2]: {
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
        await service.init('mobile', {}, [adUnitPath1, adUnitPath2], jsDomWindow.fetch, noopLogger);

        const rule = await service.getPriceRule(adUnitPath1);
        expect(rule).not.to.be.undefined;
        expect(fetchStub).to.have.been.calledThrice;
      });

      it('should always return undefined if the asset loading fails after 3 retries', async () => {
        fetchStub.rejects('FetchRequestFailed');
        const service = createService(config);

        await service.init('mobile', {}, [adUnitPath1, adUnitPath2], jsDomWindow.fetch, noopLogger);
        const rule = await service.getPriceRule(adUnitPath1);
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
        await service.init('mobile', {}, [adUnitPath1, adUnitPath2], jsDomWindow.fetch, noopLogger);

        const rule = await service.getPriceRule(adUnitPath1);
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
        await service.init('mobile', {}, [adUnitPath1, adUnitPath2], jsDomWindow.fetch, noopLogger);

        const rule = await service.getPriceRule(adUnitPath1);
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
        const adSlot = googleAdSlotStub('/123/publisher/p_content_1', adUnitPath1);

        await service.init('mobile', {}, [adUnitPath1, adUnitPath2], jsDomWindow.fetch, noopLogger);
        await service.getPriceRule(adUnitPath1);
        await service.setTargeting(adSlot, 'gam', noopLogger, config);

        expect(fetchStub).to.have.been.calledOnce;
        expect(fetchStub).to.have.been.calledOnceWithExactly(config.configEndpoint, {
          body: `{"device":"mobile","key":"adUnitPath","adUnitPaths":["${adUnitPath1}","${adUnitPath2}"]}`,
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          method: 'POST',
          mode: 'cors'
        });
      });

      it('should respect the defined excludedAdUnits', async () => {
        const service = createService({
          ...config,
          excludedAdUnitPaths: [adUnitPath1]
        });
        const adSlot = googleAdSlotStub('/123/publisher/p_content_1', adUnitPath1);

        await service.init('mobile', {}, [adUnitPath1, adUnitPath2], jsDomWindow.fetch, noopLogger);
        await service.getPriceRule(adUnitPath1);
        await service.setTargeting(adSlot, 'gam', noopLogger, config);

        expect(fetchStub).to.have.been.calledOnce;
        expect(fetchStub).to.have.been.calledOnceWithExactly(config.configEndpoint, {
          body: '{"device":"mobile","key":"adUnitPath","adUnitPaths":["/123/publisher/p_content_2"]}',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          method: 'POST',
          mode: 'cors'
        });
      });

      it('should send the resolved adUnitPath', async () => {
        const service = createService(config);
        const adSlot = googleAdSlotStub('/123/pub/ad_content_1/{device}', adUnitPath1);

        await service.init(
          'mobile',
          { device: 'mobile' },
          ['/123/pub/ad_content_1/{device}'],
          jsDomWindow.fetch,
          noopLogger
        );
        await service.getPriceRule(adUnitPath1);
        await service.setTargeting(adSlot, 'gam', noopLogger, config);

        expect(fetchStub).to.have.been.calledOnce;
        expect(fetchStub).to.have.been.calledOnceWithExactly(config.configEndpoint, {
          body: '{"device":"mobile","key":"adUnitPath","adUnitPaths":["/123/pub/ad_content_1/mobile"]}',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          method: 'POST',
          mode: 'cors'
        });
      });

      it('should return undefined if the ad slot is not configured', async () => {
        const service = createService(config);
        await service.init('mobile', {}, [adUnitPath1, adUnitPath2], jsDomWindow.fetch, noopLogger);
        const rule = await service.getPriceRule('foo');
        expect(rule).to.be.undefined;
      });

      it('should return the price rule', async () => {
        const service = createService(config);
        await service.init('mobile', {}, [adUnitPath1, adUnitPath2], jsDomWindow.fetch, noopLogger);
        const rule = await service.getPriceRule(adUnitPath1);
        expect(rule).to.be.ok;
        expect(rule!.main).to.be.true;
        expect(rule!.priceRuleId).to.be.eq(3);
        expect(rule!.floorprice).to.be.eq(0.2);
        expect(rule!.main).to.be.eq(true);
      });

      describe('setTargeting', async () => {
        let globalAuctionContext: GlobalAuctionContext;
        let getLastBidCpmsOfAdUnitStub: Sinon.SinonStub;

        beforeEach(() => {
          // stub global auction context with getLastBidCpms method
          const config: auction.GlobalAuctionContextConfig = {
            previousBidCpms: {
              enabled: true
            }
          };
          globalAuctionContext = createGlobalAuctionContext(
            jsDomWindow,
            noopLogger,
            createEventService(),
            config
          );
          getLastBidCpmsOfAdUnitStub = sandbox.stub(globalAuctionContext, 'getLastBidCpmsOfAdUnit');
        });

        it('should setTargeting with model fallback', async () => {
          const adSlot = googleAdSlotStub(adUnitPath1, 'p_content_1');
          const setTargetingSpy = sandbox.spy(adSlot, 'setTargeting');

          const service = createService(config);
          await service.init(
            'mobile',
            {},
            [adUnitPath1, adUnitPath2],
            jsDomWindow.fetch,
            noopLogger
          );
          const rule = await service.getPriceRule(adUnitPath1);
          await service.setTargeting(adSlot, 'gam', noopLogger, config, globalAuctionContext);

          expect(setTargetingSpy).has.been.calledWith('upr_id', rule!.priceRuleId.toFixed(0));
          expect(setTargetingSpy).has.been.calledWith('upr_model', 'static');
          expect(setTargetingSpy).has.been.calledWith('upr_main', `${rule!.main}`);
        });

        it('should setTargeting with model', async () => {
          const adSlot = googleAdSlotStub(adUnitPath2, 'p_content_2');
          const setTargetingSpy = sandbox.spy(adSlot, 'setTargeting');

          const service = createService(config);
          await service.init(
            'mobile',
            {},
            [adUnitPath1, adUnitPath2],
            jsDomWindow.fetch,
            noopLogger
          );
          await service.setTargeting(adSlot, 'gam', noopLogger, config);

          expect(setTargetingSpy).has.been.calledWith('upr_model', 'ml');
        });

        it('should overwrite the standard price rule with the dynamic floor price based on the last bid cpms if yield config is dynamic and strategy is available', async () => {
          const configWithDynamicFloorStrategy: DynamicYieldOptimizationConfig = {
            enabled: true,
            provider: 'dynamic',
            configEndpoint: '//localhost',
            excludedAdUnitPaths: [],
            dynamicFloorPrices: {
              strategy: 'max',
              roundingStepsInCents: 5,
              maxPriceRuleInCents: 500,
              minPriceRuleInCents: 5
            }
          };

          getLastBidCpmsOfAdUnitStub.withArgs('p_content_1').returns([1.5, 5.0]);

          const adSlot = googleAdSlotStub(adUnitPath1, 'p_content_1');
          const setTargetingSpy = sandbox.spy(adSlot, 'setTargeting');

          const service = createService(configWithDynamicFloorStrategy);
          await service.init('mobile', {}, [adUnitPath1], fetchStub, noopLogger);
          await service.setTargeting(
            adSlot,
            'gam',
            noopLogger,
            configWithDynamicFloorStrategy,
            globalAuctionContext
          );

          expect(setTargetingSpy).has.been.calledWith('upr_model', 'static');
          expect(setTargetingSpy).has.been.calledWith('upr_main', 'true');
          expect(setTargetingSpy).has.been.calledWith('upr_id', '500');
        });

        it('should NOT overwrite the standard price rule if yield config is dynamic and strategy is not available', async () => {
          const configWithoutDynamicFloorStrategy: DynamicYieldOptimizationConfig = {
            enabled: true,
            provider: 'dynamic',
            configEndpoint: '//localhost',
            excludedAdUnitPaths: []
          };

          getLastBidCpmsOfAdUnitStub.withArgs('p_content_1').returns([1.5, 5.0]);

          const adSlot = googleAdSlotStub(adUnitPath1, 'p_content_1');
          const setTargetingSpy = sandbox.spy(adSlot, 'setTargeting');

          const service = createService(configWithoutDynamicFloorStrategy);
          await service.init('mobile', {}, [adUnitPath1], fetchStub, noopLogger);
          await service.setTargeting(
            adSlot,
            'gam',
            noopLogger,
            configWithoutDynamicFloorStrategy,
            globalAuctionContext
          );

          expect(setTargetingSpy).has.been.calledWith('upr_id', '3');
        });
        it('should NOT overwrite the standard price rule if yield config is dynamic and there are no last bids', async () => {
          const yieldConfig: DynamicYieldOptimizationConfig = {
            enabled: true,
            provider: 'dynamic',
            configEndpoint: '//localhost',
            excludedAdUnitPaths: [],
            dynamicFloorPrices: {
              strategy: 'max',
              roundingStepsInCents: 5,
              maxPriceRuleInCents: 500,
              minPriceRuleInCents: 5
            }
          };

          getLastBidCpmsOfAdUnitStub.withArgs('p_content_1').returns([]);

          const adSlot = googleAdSlotStub(adUnitPath1, 'p_content_1');
          const setTargetingSpy = sandbox.spy(adSlot, 'setTargeting');

          const service = createService(yieldConfig);
          await service.init('mobile', {}, [adUnitPath1], fetchStub, noopLogger);
          await service.setTargeting(adSlot, 'gam', noopLogger, yieldConfig, globalAuctionContext);

          expect(setTargetingSpy).has.been.calledWith('upr_id', '3');
        });
        it('should NOT overwrite the standard price rule if config is other than dynamic', async () => {
          const yieldConfig: StaticYieldOptimizationConfig = {
            enabled: true,
            provider: 'static',
            config: {
              rules: {
                [adUnitPath1]: {
                  priceRuleId: 3,
                  floorprice: 0.2,
                  main: true
                }
              }
            }
          };
          getLastBidCpmsOfAdUnitStub.withArgs('p_content_1').returns([1.5, 5.0]);

          const adSlot = googleAdSlotStub(adUnitPath1, 'p_content_1');
          const setTargetingSpy = sandbox.spy(adSlot, 'setTargeting');

          const service = createService(yieldConfig);
          await service.init('mobile', {}, [adUnitPath1], fetchStub, noopLogger);
          await service.setTargeting(adSlot, 'gam', noopLogger, yieldConfig, globalAuctionContext);

          expect(setTargetingSpy).has.been.calledWith('upr_id', '3');
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
      ['mobile' as const, 'desktop' as const].forEach(device => {
        it(`should use ${device} in body`, async () => {
          const service = createService(config);
          const adSlot = googleAdSlotStub(adUnitPath1, 'p_content_1');

          await service.init(device, {}, [], jsDomWindow.fetch, noopLogger);
          await service.getPriceRule(adUnitPath1);
          await service.setTargeting(adSlot, 'gam', noopLogger, config);

          expect(fetchStub).to.have.been.calledOnce;
          expect(fetchStub).to.have.been.calledOnceWithExactly(config.configEndpoint, {
            body: `{"device":"${device}","key":"adUnitPath","adUnitPaths":[]}`,
            headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
            method: 'POST',
            mode: 'cors'
          });
        });
      });
    });
  });
});
