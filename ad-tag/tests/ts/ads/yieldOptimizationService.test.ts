import { createDom } from '../stubs/browserEnvSetup';
import { expect, use } from 'chai';
import * as sinonChai from 'sinon-chai';
import * as Sinon from 'sinon';
import { Moli } from '../../../source/ts/types/moli';
import NoYieldOptimizationConfig = Moli.yield_optimization.NoYieldOptimizationConfig;
import { YieldOptimizationService } from '../../../source/ts/ads/yieldOptimizationService';
import { createAssetLoaderService } from '../../../source/ts/util/assetLoaderService';
import { noopLogger } from '../stubs/moliStubs';
import { googleAdSlotStub } from '../stubs/googletagStubs';
import StaticYieldOptimizationConfig = Moli.yield_optimization.StaticYieldOptimizationConfig;
import YieldOptimizationConfig = Moli.yield_optimization.YieldOptimizationConfig;
import DynamicYieldOptimizationConfig = Moli.yield_optimization.DynamicYieldOptimizationConfig;
import PublisherYieldConfiguration = Moli.yield_optimization.PublisherYieldConfiguration;

// setup sinon-chai
use(sinonChai);

// tslint:disable: no-unused-expression
describe('YieldOptimizationService', () => {

  const dom = createDom();

  // single sandbox instance to create spies and stubs
  const sandbox = Sinon.createSandbox();
  const assetLoaderService = createAssetLoaderService(dom.window);
  const assetLoaderLoadJsonStub = sandbox.stub(assetLoaderService, 'loadJson');

  const createService = (config: YieldOptimizationConfig, trafficShare?: () => number): YieldOptimizationService => {
    return new YieldOptimizationService(config, assetLoaderService, noopLogger, trafficShare);
  };

  const buildTrafficShareArray = (from: number, to: number): number[] => {
    const shares: number[] = [];
    for (let share = from; share <= to; share++) {
      shares.push(share);
    }
    return shares;
  };

  afterEach(() => {
    sandbox.reset();
  });

  describe('provider: none', () => {

    const config: NoYieldOptimizationConfig = { provider: 'none' };
    const service = createService(config);

    it('should always return undefined', () => {
      return service.getPriceRule('foo').then(rule => {
        expect(rule).to.be.undefined;
      });
    });

    it('should not set any key-values', () => {
      const adSlot = googleAdSlotStub('/123/publisher/p_content_1', 'ad_content_1');
      const getSlotElementIdSpy = sandbox.spy(adSlot, 'getSlotElementId');
      const setTargetingSpy = sandbox.spy(adSlot, 'setTargeting');

      return service.setTargeting(adSlot).then(_ => {
        expect(getSlotElementIdSpy).to.have.been.calledOnce;
        expect(setTargetingSpy).to.not.have.been.called;
      });
    });
  });

  describe('provider: static', () => {

    describe('empty config', () => {
      const config: StaticYieldOptimizationConfig = { provider: 'static', config: { rules: [] } };
      const service = createService(config);

      it('should always return undefined', () => {
        return service.getPriceRule('foo').then(rule => {
          expect(rule).to.be.undefined;
        });
      });

      it('should not set any key-values', () => {
        const adSlot = googleAdSlotStub('/123/publisher/p_content_1', 'ad_content_1');
        const getSlotElementIdSpy = sandbox.spy(adSlot, 'getSlotElementId');
        const setTargetingSpy = sandbox.spy(adSlot, 'setTargeting');

        return service.setTargeting(adSlot).then(_ => {
          expect(getSlotElementIdSpy).to.have.been.calledOnce;
          expect(setTargetingSpy).to.not.have.been.called;
        });
      });
    });

    describe('non empty config', () => {
      const adUnit = 'ad_content_1';
      const config: StaticYieldOptimizationConfig = {
        provider: 'static', config: {
          rules: [
            {
              adUnitName: adUnit,
              main: {
                priceRuleId: 3
              },
              tests: [
                { priceRuleId: 1 },
                { priceRuleId: 2 },
                { priceRuleId: 4 },
                { priceRuleId: 5 }
              ]
            }
          ]
        }
      };

      it('should return undefined if the ad slot is not configured', () => {
        const service = createService(config);
        return service.getPriceRule('foo').then(rule => {
          expect(rule).to.be.undefined;
        });
      });

      it('should return the main priceRuleId 3 for 80% of the traffic ', () => {
        const assertions = buildTrafficShareArray(20, 99).map((trafficShare) => {
          const service = createService(config, () => trafficShare);
          return service.getPriceRule(adUnit).then(rule => {
            expect(rule).to.be.ok;
            expect(rule!.main).to.be.true;
            expect(rule!.priceRuleId).to.be.eq(3);
          });
        });
        return Promise.all(assertions);
      });

      it('should set the main priceRuleId 3 for 80% of the traffic and set the upr_main key-value ', () => {
        const adSlot = googleAdSlotStub('/123/publisher/p_content_1', adUnit);
        const setTargetingSpy = sandbox.spy(adSlot, 'setTargeting');

        const assertions = buildTrafficShareArray(20, 99).map((trafficShare) => {
          const service = createService(config, () => trafficShare);
          return service.setTargeting(adSlot).then(_ => {
            expect(setTargetingSpy).to.have.been.calledWithExactly('upr_id', '3');
            expect(setTargetingSpy).to.have.been.calledWithExactly('upr_main', 'true');
          });
        });
        return Promise.all(assertions);
      });

      it('should return the price rules based on the traffic share and array index ', () => {
        const ruleExpectations = [
          { priceRuleId: 1, shares: [ 0, 5, 10, 15 ] },
          { priceRuleId: 2, shares: [ 1, 6, 11, 16 ] },
          { priceRuleId: 4, shares: [ 2, 7, 12, 17 ] },
          { priceRuleId: 5, shares: [ 3, 8, 13, 18 ] },
          // the main rule is appended to the end
          { priceRuleId: 3, shares: [ 4, 9, 14, 19 ] }
        ];

        const assertions = ruleExpectations.map(({ priceRuleId, shares }) => {
          const priceRuleAssertions = shares.map((trafficShare) => {
            const service = createService(config, () => trafficShare);
            return service.getPriceRule(adUnit).then(rule => {
              expect(rule).to.be.ok;
              expect(rule!.main).to.be.undefined;
              expect(rule!.priceRuleId).to.be.eq(priceRuleId, `Wrong priceRuleId for trafficShare [${trafficShare}]`);
            });
          });
          return Promise.all(priceRuleAssertions);
        });

        return Promise.all(assertions);
      });

      it('should set the price rule key values based on the traffic share and array index ', () => {
        const adSlot = googleAdSlotStub('/123/publisher/p_content_1', adUnit);
        const setTargetingSpy = sandbox.spy(adSlot, 'setTargeting');
        const ruleExpectations = [
          { priceRuleId: 1, shares: [ 0, 5, 10, 15 ] },
          { priceRuleId: 2, shares: [ 1, 6, 11, 16 ] },
          { priceRuleId: 4, shares: [ 2, 7, 12, 17 ] },
          { priceRuleId: 5, shares: [ 3, 8, 13, 18 ] },
          // the main rule is appended to the end
          { priceRuleId: 3, shares: [ 4, 9, 14, 19 ] }
        ];

        const assertions = ruleExpectations.map(({ priceRuleId, shares }) => {
          const priceRuleAssertions = shares.map((trafficShare) => {
            const service = createService(config, () => trafficShare);
            return service.setTargeting(adSlot).then(_ => {
              expect(setTargetingSpy).to.have.been.calledWithExactly('upr_id', priceRuleId.toFixed(0));
            });
          });
          return Promise.all(priceRuleAssertions);
        });

        return Promise.all(assertions);
      });


    });
  });

  describe('provider: dynamic', () => {

    const adUnit = 'ad_content_1';
    const config: DynamicYieldOptimizationConfig = {
      provider: 'dynamic',
      configEndpoint: '//localhost'
    };

    const publisherYieldConfiguration: PublisherYieldConfiguration = {
      rules: [
        {
          adUnitName: adUnit,
          main: {
            priceRuleId: 3
          },
          tests: [
            { priceRuleId: 1 },
            { priceRuleId: 2 },
            { priceRuleId: 4 },
            { priceRuleId: 5 }
          ]
        }
      ]
    };

    describe('error handling', () => {

      it('should retry three times', () => {
        assetLoaderLoadJsonStub.onFirstCall().rejects('FetchRequestFailed');
        assetLoaderLoadJsonStub.onSecondCall().rejects('FetchRequestFailed');
        assetLoaderLoadJsonStub.onThirdCall().resolves(publisherYieldConfiguration);
        const service = createService(config);

        return service.getPriceRule(adUnit).then(rule => {
          expect(rule).not.to.be.undefined;
          expect(assetLoaderLoadJsonStub).to.have.been.calledThrice;
        });
      });

      it('should always return undefined if the asset loading fails after 3 retries', () => {
        assetLoaderLoadJsonStub.rejects('FetchRequestFailed');
        const service = createService(config);

        return service.getPriceRule(adUnit).then(rule => {
          expect(rule).to.be.undefined;
          expect(assetLoaderLoadJsonStub).to.have.been.calledThrice;
        });
      });

      it('should always return undefined if the response is not json', () => {
        assetLoaderLoadJsonStub.resolves('not json');
        const service = createService(config);

        return service.getPriceRule(adUnit).then(rule => {
          expect(rule).to.be.undefined;
          expect(assetLoaderLoadJsonStub).to.have.been.called;
        });
      });

      it('should always return undefined if the config json has the wrong format', () => {
        assetLoaderLoadJsonStub.resolves({
          ok: true,
          json: () => Promise.reject([ {}, {} ])
        });
        const service = createService(config);

        return service.getPriceRule(adUnit).then(rule => {
          expect(rule).to.be.undefined;
          expect(assetLoaderLoadJsonStub).to.have.been.called;
        });
      });

    });

    describe('non empty config', () => {
      beforeEach(() => {
        assetLoaderLoadJsonStub.resolves(publisherYieldConfiguration);
      });


      it('should call the configured endpoint only once', () => {
        const service = createService(config);
        const adSlot = googleAdSlotStub('/123/publisher/p_content_1', adUnit);

        return Promise.all([ service.getPriceRule(adUnit), service.setTargeting(adSlot) ]).then(_ => {
          expect(assetLoaderLoadJsonStub).to.have.been.calledOnce;
          expect(assetLoaderLoadJsonStub).to.have.been.calledOnceWithExactly(
            'yield-config.json', config.configEndpoint
          );
        });
      });

      it('should return undefined if the ad slot is not configured', () => {
        const service = createService(config);
        return service.getPriceRule('foo').then(rule => {
          expect(rule).to.be.undefined;
        });
      });

      it('should return the main priceRuleId 3 for 80% of the traffic ', () => {
        const assertions = buildTrafficShareArray(20, 99).map((trafficShare) => {
          const service = createService(config, () => trafficShare);
          return service.getPriceRule(adUnit).then(rule => {
            expect(rule).to.be.ok;
            expect(rule!.main).to.be.true;
            expect(rule!.priceRuleId).to.be.eq(3);
          });
        });
        return Promise.all(assertions);
      });

      it('should set the main priceRuleId 3 for 80% of the traffic and set the upr_main key-value ', () => {
        const adSlot = googleAdSlotStub('/123/publisher/p_content_1', adUnit);
        const setTargetingSpy = sandbox.spy(adSlot, 'setTargeting');

        const assertions = buildTrafficShareArray(20, 99).map((trafficShare) => {
          const service = createService(config, () => trafficShare);
          return service.setTargeting(adSlot).then(_ => {
            expect(setTargetingSpy).to.have.been.calledWithExactly('upr_id', '3');
            expect(setTargetingSpy).to.have.been.calledWithExactly('upr_main', 'true');
          });
        });
        return Promise.all(assertions);
      });

      it('should return the price rules based on the traffic share and array index ', () => {
        const ruleExpectations = [
          { priceRuleId: 1, shares: [ 0, 5, 10, 15 ] },
          { priceRuleId: 2, shares: [ 1, 6, 11, 16 ] },
          { priceRuleId: 4, shares: [ 2, 7, 12, 17 ] },
          { priceRuleId: 5, shares: [ 3, 8, 13, 18 ] },
          // the main rule is appended to the end
          { priceRuleId: 3, shares: [ 4, 9, 14, 19 ] }
        ];

        const assertions = ruleExpectations.map(({ priceRuleId, shares }) => {
          const priceRuleAssertions = shares.map((trafficShare) => {
            const service = createService(config, () => trafficShare);
            return service.getPriceRule(adUnit).then(rule => {
              expect(rule).to.be.ok;
              expect(rule!.main).to.be.undefined;
              expect(rule!.priceRuleId).to.be.eq(priceRuleId, `Wrong priceRuleId for trafficShare [${trafficShare}]`);
            });
          });
          return Promise.all(priceRuleAssertions);
        });

        return Promise.all(assertions);
      });

      it('should set the price rule key values based on the traffic share and array index ', () => {
        const adSlot = googleAdSlotStub('/123/publisher/p_content_1', adUnit);
        const setTargetingSpy = sandbox.spy(adSlot, 'setTargeting');
        const ruleExpectations = [
          { priceRuleId: 1, shares: [ 0, 5, 10, 15 ] },
          { priceRuleId: 2, shares: [ 1, 6, 11, 16 ] },
          { priceRuleId: 4, shares: [ 2, 7, 12, 17 ] },
          { priceRuleId: 5, shares: [ 3, 8, 13, 18 ] },
          // the main rule is appended to the end
          { priceRuleId: 3, shares: [ 4, 9, 14, 19 ] }
        ];

        const assertions = ruleExpectations.map(({ priceRuleId, shares }) => {
          const priceRuleAssertions = shares.map((trafficShare) => {
            const service = createService(config, () => trafficShare);
            return service.setTargeting(adSlot).then(_ => {
              expect(setTargetingSpy).to.have.been.calledWithExactly('upr_id', priceRuleId.toFixed(0));
            });
          });
          return Promise.all(priceRuleAssertions);
        });

        return Promise.all(assertions);
      });
    });
  });

  describe('price rule cpms', () => {

    it('resolve cpms for known price rule ids', () => {
      const adUnit = 'ad_content_1';
      const config: StaticYieldOptimizationConfig = {
        provider: 'static', config: {
          rules: [
            {
              adUnitName: adUnit,
              main: {
                priceRuleId: 39558984
              },
              tests: [
                { priceRuleId: 39836957 },
                { priceRuleId: 39837404 },
                { priceRuleId: 39837407 },
                { priceRuleId: 39707353 }
              ]
            }
          ]
        }
      };
      return createService(config).getPriceRule(adUnit).then(priceRule => {
        expect(priceRule).to.be.ok;
        expect(priceRule?.cpm).to.be.ok;
        expect(priceRule?.cpm).to.be.oneOf([ 0.15, 0.10, 0.30, 0.35 ]);
      });
    });

    it('leaves cpm undefined for unknown price rules ', () => {
      const adUnit = 'ad_content_1';
      const config: StaticYieldOptimizationConfig = {
        provider: 'static', config: {
          rules: [
            {
              adUnitName: adUnit,
              main: {
                priceRuleId: 1
              },
              tests: [
                { priceRuleId: 2 },
                { priceRuleId: 3 },
                { priceRuleId: 4 },
                { priceRuleId: 5 }
              ]
            }
          ]
        }
      };

      return createService(config).getPriceRule(adUnit).then(priceRule => {
        expect(priceRule).to.be.ok;
        expect(priceRule?.cpm).to.be.undefined;
      });
    });
  });

});
// tslint:enable
