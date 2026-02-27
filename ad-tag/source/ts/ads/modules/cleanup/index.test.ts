import * as Sinon from 'sinon';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';
import { createDom } from 'ad-tag/stubs/browserEnvSetup';
import { emptyConfig, emptyRuntimeConfig, newNoopLogger } from 'ad-tag/stubs/moliStubs';
import { createCleanup, ICleanupModule } from './index';
import { fullConsent } from 'ad-tag/stubs/consentStubs';
import { createMoliTag } from 'ad-tag/ads/moli';
import { AdSlot, modules } from 'ad-tag/types/moliConfig';
import { googletag } from 'ad-tag/types/googletag';
import IAdSlot = googletag.IAdSlot;
import { MoliRuntime } from 'ad-tag/types/moliRuntime';
import { AdPipelineContext } from '../../adPipeline';
import { createAssetLoaderService } from 'ad-tag/util/assetLoaderService';
import { createPbjsStub } from 'ad-tag/stubs/prebidjsStubs';

// setup sinon-chai
use(sinonChai);
use(chaiAsPromised);

describe('Cleanup Module', () => {
  let sandbox = Sinon.createSandbox();
  let dom = createDom();
  let jsDomWindow = dom.window as any;
  jsDomWindow.moli = createMoliTag(jsDomWindow);
  jsDomWindow.pbjs = createPbjsStub();
  const noopLogger = newNoopLogger(true);
  const errorLogSpy = sandbox.spy(noopLogger, 'error');

  const domId1 = 'gf_content_1';
  const domId2 = 'gf_wallpaper_pixel';
  const domId3 = 'gf_mobile_sticky';
  const specialFormatClass1 = 'seedtag-container1';
  const specialFormatClass2 = 'seedtag-container2';
  const specialFormatClass3 = 'other-container';

  const createAndConfigureModule = (cleanup: modules.cleanup.CleanupModuleConfig): ICleanupModule => {
    const module = createCleanup();
    module.configure__({ cleanup });
    return module;
  };

  beforeEach(() => {
    sandbox = Sinon.createSandbox();
    dom = createDom();
    jsDomWindow = dom.window;
    jsDomWindow.moli = createMoliTag(jsDomWindow);
    jsDomWindow.pbjs = createPbjsStub();

    // add special format elements to the dom
    [specialFormatClass1, specialFormatClass2, specialFormatClass3].forEach(className => {
      const specialFormatElementSeedtag = jsDomWindow.document.createElement('div');
      specialFormatElementSeedtag.classList.add(className);
      jsDomWindow.document.body.appendChild(specialFormatElementSeedtag);
    });
  });

  afterEach(() => {
    sandbox.restore();
  });

  const createAdSlots = (
    window: Window,
    domIds: string[],
    behaviour?: 'eager' | 'manual',
    bucket?: string
  ): AdSlot[] => {
    return domIds.map(domId => {
      const div = window.document.createElement('div');
      div.id = domId;
      window.document.body.appendChild(div);

      const slot: AdSlot = {
        domId: domId,
        adUnitPath: domId,
        position: 'in-page',
        sizes: [],
        behaviour: { loaded: behaviour ?? 'manual', bucket: bucket },
        sizeConfig: []
      };
      return slot;
    });
  };

  const createSlotDefinition = (domId: string): MoliRuntime.SlotDefinition => {
    return {
      moliSlot: {
        domId: domId,
        position: 'in-page',
        behaviour: {
          loaded: 'manual',
          bucket: 'bucket-one'
        },
        adUnitPath: '/55155651/prebid_test',
        sizes: [[300, 250]],
        sizeConfig: [
          {
            mediaQuery: '(min-width: 0px)',
            sizesSupported: [[300, 250]]
          }
        ]
      },
      adSlot: {} as IAdSlot,
      filterSupportedSizes: () => [[300, 250]]
    };
  };

  const adPipelineContext = (): AdPipelineContext => {
    return {
      auctionId__: 'xxxx-xxxx-xxxx-xxxx',
      requestId__: 0,
      requestAdsCalls__: 1,
      env__: 'production',
      logger__: { ...noopLogger, error: errorLogSpy },
      config__: {
        ...emptyConfig,
        spa: { enabled: true, validateLocation: 'href' }
      },
      runtimeConfig__: emptyRuntimeConfig,
      window__: jsDomWindow as any,
      // no service dependencies required
      labelConfigService__: null as any,
      tcData__: fullConsent(),
      adUnitPathVariables__: {},
      auction__: null as any,
      assetLoaderService__: createAssetLoaderService(jsDomWindow)
    };
  };

  it('should not add a configure and prepare request ads pipeline step if disabled', () => {
    const module = createCleanup();

    module.configure__({ cleanup: { enabled: false, configs: [] } });

    const configureSteps = module.configureSteps__();
    const prepareRequestAdsSteps = module.prepareRequestAdsSteps__();

    expect(configureSteps.length).to.equal(0);
    expect(prepareRequestAdsSteps.length).to.equal(0);
  });

  it('should add a configure and prepare request ads pipeline step', () => {
    const module = createAndConfigureModule({ enabled: true, configs: [] });

    const configureSteps = module.configureSteps__();
    const prepareRequestAdsSteps = module.prepareRequestAdsSteps__();

    expect(configureSteps.length).to.equal(1);
    expect(prepareRequestAdsSteps.length).to.equal(1);
  });

  it('should not call cleanup if environment is test', async () => {
    const module = createAndConfigureModule({ enabled: true, configs: [] });
    const cleanupSpy = sandbox.spy(module, 'cleanUp');

    const configure = module.configureSteps__()[0];
    await configure(
      { ...adPipelineContext(), runtimeConfig__: { ...emptyRuntimeConfig, environment: 'test' } },
      []
    );
    expect(cleanupSpy).to.have.not.been.called;

    const prepareRequestAds = module.prepareRequestAdsSteps__()[0];
    expect(prepareRequestAds?.name).to.be.eq('cleanup-before-ad-reload');

    await prepareRequestAds(
      { ...adPipelineContext(), runtimeConfig__: { ...emptyRuntimeConfig, environment: 'test' } },
      []
    );
    expect(cleanupSpy).to.not.have.been.called;
  });

  it('should remove all elements with the configured CSS selectors from the dom or execute the configured JS in the configure step', async () => {
    jsDomWindow.pbjs = {
      ...createPbjsStub(),
      getAllWinningBids: () => [
        { adUnitCode: domId1, bidder: 'seedtag' },
        { adUnitCode: domId2, bidder: 'seedtag' },
        { adUnitCode: domId3, bidder: 'dspx' }
      ]
    };
    const module = createAndConfigureModule({
      enabled: true,
      configs: [
        {
          bidder: 'seedtag',
          domId: domId1,
          deleteMethod: {
            cssSelectors: [`.${specialFormatClass1}`]
          }
        },
        {
          bidder: 'seedtag',
          domId: domId2,
          deleteMethod: {
            cssSelectors: [`.${specialFormatClass2}`]
          }
        },
        {
          bidder: 'dspx',
          domId: domId3,
          deleteMethod: {
            jsAsString: [`globalThis.console.log('JS for slot ${domId3} is being executed');`]
          }
        }
      ]
    });

    const slots = createAdSlots(jsDomWindow, [domId1, domId2, domId3]);
    const consoleLogSpy = sandbox.spy(globalThis.console, 'log');

    const configure = module.configureSteps__()[0];
    await configure(adPipelineContext(), slots);

    const specialFormatElementsInDom = [
      ...jsDomWindow.document.querySelectorAll(`.${specialFormatClass1}`),
      ...jsDomWindow.document.querySelectorAll(`.${specialFormatClass2}`)
    ];

    expect(specialFormatElementsInDom).to.have.length(0);
    expect(consoleLogSpy.calledWith(`JS for slot ${domId3} is being executed`)).to.be.true;
  });

  it('should only clean if the configured bidder has won the last auction on the slot in the configure step (prevents cleaning on first page load)', async () => {
    jsDomWindow.pbjs = {
      ...jsDomWindow.pbjs,
      getAllWinningBids: () => [{ adUnitCode: domId2, bidder: 'dspx' }]
    };

    const module = createAndConfigureModule({
      enabled: true,
      configs: [
        {
          bidder: 'seedtag',
          domId: domId1,
          deleteMethod: {
            cssSelectors: [`.${specialFormatClass1}`]
          }
        },
        {
          bidder: 'seedtag',
          domId: domId2,
          deleteMethod: {
            cssSelectors: [`.${specialFormatClass2}`]
          }
        },
        {
          bidder: 'dspx',
          domId: domId2,
          deleteMethod: {
            jsAsString: [`globalThis.console.log('JS for slot ${domId3} is being executed');`]
          }
        }
      ]
    });

    const slots = createAdSlots(jsDomWindow, [domId1, domId2]);
    const consoleLogSpy = sandbox.spy(globalThis.console, 'log');

    const configure = module.configureSteps__()[0];
    await configure(adPipelineContext(), slots);

    const specialFormatElementsInDom = [
      ...jsDomWindow.document.querySelectorAll(`.${specialFormatClass1}`),
      ...jsDomWindow.document.querySelectorAll(`.${specialFormatClass2}`)
    ];

    expect(specialFormatElementsInDom).to.have.length(2);
    expect(consoleLogSpy.calledWith(`JS for slot ${domId3} is being executed`)).to.be.true;
  });

  describe('only call clean up for the bidder winning the last auction on the given slot', () => {
    it('should clean up in configure step (prevents cleaning on first page load)', async () => {
      jsDomWindow.pbjs = {
        ...jsDomWindow.pbjs,
        getAllWinningBids: () => [{ adUnitCode: domId2, bidder: 'dspx' }]
      };
      const module = createAndConfigureModule({
        enabled: true,
        configs: [
          {
            bidder: 'seedtag',
            domId: domId1,
            deleteMethod: {
              cssSelectors: [`.${specialFormatClass1}`]
            }
          },
          {
            bidder: 'seedtag',
            domId: domId2,
            deleteMethod: {
              cssSelectors: [`.${specialFormatClass2}`]
            }
          },
          {
            bidder: 'dspx',
            domId: domId2,
            deleteMethod: {
              jsAsString: [
                `globalThis.console.log('JS for slot ${domId2} and bidder dspx is being executed');`
              ]
            }
          }
        ]
      });

      const slots = createAdSlots(jsDomWindow, [domId1, domId2]);
      const consoleLogSpy = sandbox.spy(globalThis.console, 'log');

      const configure = module.configureSteps__()[0];
      await configure(adPipelineContext(), slots);

      const specialFormatElementsInDom = [
        ...jsDomWindow.document.querySelectorAll(`.${specialFormatClass1}`),
        ...jsDomWindow.document.querySelectorAll(`.${specialFormatClass2}`)
      ];

      expect(specialFormatElementsInDom).to.have.length(2);
      expect(consoleLogSpy).to.be.calledWith(
        `JS for slot ${domId2} and bidder dspx is being executed`
      );
    });

    it('should clean up in the prepare request ads step if the configured slot is reloaded and the corresponding configured bidder has won the last auction', async () => {
      jsDomWindow.pbjs = {
        ...jsDomWindow.pbjs,
        getAllWinningBids: () => [{ adUnitCode: domId2, bidder: 'dspx' }]
      };
      const module = createAndConfigureModule({
        enabled: true,
        configs: [
          {
            bidder: 'seedtag',
            domId: domId1,
            deleteMethod: {
              cssSelectors: [`.${specialFormatClass1}`]
            }
          },
          {
            bidder: 'seedtag',
            domId: domId2,
            deleteMethod: {
              cssSelectors: [`.${specialFormatClass2}`]
            }
          },
          {
            bidder: 'dspx',
            domId: domId2,
            deleteMethod: {
              jsAsString: [
                `globalThis.console.log('JS for slot ${domId2} and bidder dspx is being executed');`
              ]
            }
          },
          {
            bidder: 'visx',
            domId: domId3,
            deleteMethod: {
              jsAsString: [
                `globalThis.console.log('JS for slot ${domId3} and bidder visx is being executed');`
              ]
            }
          }
        ]
      });

      const consoleLogSpy = sandbox.spy(globalThis.console, 'log');

      const prepareRequestAds = module.prepareRequestAdsSteps__()[0];

      expect(prepareRequestAds?.name).to.be.eq('cleanup-before-ad-reload');
      // only one of the configured slots is reloaded
      await prepareRequestAds(adPipelineContext(), [createSlotDefinition(domId2)]);

      const specialFormatElementsSeedtagInDom = [
        ...jsDomWindow.document.querySelectorAll(`.${specialFormatClass1}`),
        ...jsDomWindow.document.querySelectorAll(`.${specialFormatClass2}`)
      ];

      // seedtag did not win the last auction on the slot that is reloaded and should not be cleaned
      expect(specialFormatElementsSeedtagInDom).to.have.length(2);
      // dspx won the last auction on the slot that is reloaded and should be cleaned
      expect(consoleLogSpy).to.be.calledWith(
        `JS for slot ${domId2} and bidder dspx is being executed`
      );
      // visx is not reloaded and should therefore not be cleaned
      expect(consoleLogSpy).not.to.be.calledWith(
        `JS for slot ${domId3} and bidder visx is being executed`
      );
    });

    it('choose the last auction if there were multiple', async () => {
      jsDomWindow.pbjs = {
        ...jsDomWindow.pbjs,
        getAllWinningBids: () => [
          { adUnitCode: domId1, bidder: 'seedtag' },
          { adUnitCode: domId1, bidder: 'dspx' }
        ]
      };
      const module = createAndConfigureModule({
        enabled: true,
        configs: [
          {
            bidder: 'seedtag',
            domId: domId1,
            deleteMethod: {
              cssSelectors: [`.${specialFormatClass2}`]
            }
          },
          {
            bidder: 'dspx',
            domId: domId1,
            deleteMethod: {
              jsAsString: [
                `globalThis.console.log('JS for slot ${domId1} and bidder dspx is being executed');`
              ]
            }
          }
        ]
      });

      const slots = createAdSlots(jsDomWindow, [domId1]);
      const consoleLogSpy = sandbox.spy(globalThis.console, 'log');

      const configure = module.configureSteps__()[0];
      await configure(adPipelineContext(), slots);

      const specialFormatElementsInDom = [
        ...jsDomWindow.document.querySelectorAll(`.${specialFormatClass1}`),
        ...jsDomWindow.document.querySelectorAll(`.${specialFormatClass2}`)
      ];

      expect(specialFormatElementsInDom).to.have.length(2);
      expect(consoleLogSpy).to.be.calledWith(
        `JS for slot ${domId1} and bidder dspx is being executed`
      );
    });
  });

  it('should log an error message if the javascript in the deleteMethod is broken and continue without crashing ', async () => {
    jsDomWindow.pbjs = {
      ...jsDomWindow.pbjs,
      getAllWinningBids: () => [{ adUnitCode: domId1, bidder: 'dspx' }]
    };
    const module = createAndConfigureModule({
      enabled: true,
      configs: [
        {
          bidder: 'dspx',
          domId: domId1,
          deleteMethod: {
            jsAsString: [
              `globalThis.csole.log('This is broken');`,
              `globalThis.console.log('This is not broken');`
            ]
          }
        }
      ]
    });

    const slots = createAdSlots(jsDomWindow, [domId1]);
    const consoleLogSpy = sandbox.spy(globalThis.console, 'log');

    const configure = module.configureSteps__()[0];

    expect(configure?.name).to.be.eq('destroy-out-of-page-ad-format');
    await configure(adPipelineContext(), slots);

    expect(errorLogSpy.called).to.be.true;
    expect(consoleLogSpy.calledWith(`This is broken`)).to.be.false;
    expect(consoleLogSpy.calledWith(`This is not broken`)).to.be.true;
  });
});
