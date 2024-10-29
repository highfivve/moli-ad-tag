import * as Sinon from 'sinon';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';
import { createDom } from 'ad-tag/stubs/browserEnvSetup';
import { emptyConfig, emptyRuntimeConfig, newNoopLogger } from 'ad-tag/stubs/moliStubs';
import { Cleanup } from './index';
import { fullConsent } from 'ad-tag/stubs/consentStubs';
import { createMoliTag } from 'ad-tag/ads/moli';
import { AdSlot, modules } from 'ad-tag/types/moliConfig';
import { googletag } from 'ad-tag/types/googletag';
import IAdSlot = googletag.IAdSlot;
import { MoliRuntime } from 'ad-tag/types/moliRuntime';
import { AdPipelineContext } from '../../adPipeline';
import { createAssetLoaderService } from 'ad-tag/util/assetLoaderService';

// setup sinon-chai
use(sinonChai);
use(chaiAsPromised);

describe('Cleanup Module', () => {
  let sandbox = Sinon.createSandbox();
  let dom = createDom();
  let jsDomWindow = dom.window as any;
  jsDomWindow.moli = createMoliTag(jsDomWindow);
  const noopLogger = newNoopLogger(true);
  const errorLogSpy = sandbox.spy(noopLogger, 'error');

  const domId1 = 'gf_content_1';
  const domId2 = 'gf_wallpaper_pixel';
  const domId3 = 'gf_mobile_sticky';
  const specialFormatClass1 = 'seedtag-container1';
  const specialFormatClass2 = 'seedtag-container2';
  const specialFormatClass3 = 'other-container';

  const createAndConfigureModule = (cleanup: modules.cleanup.CleanupModuleConfig): Cleanup => {
    const module = new Cleanup();
    module.configure({ cleanup });
    return module;
  };

  beforeEach(() => {
    sandbox = Sinon.createSandbox();
    dom = createDom();
    jsDomWindow = {
      ...dom.window,
      pbjs: {
        getAllWinningBids: () => [
          { adUnitCode: domId1, bidder: 'seedtag' },
          { adUnitCode: domId2, bidder: 'seedtag' },
          { adUnitCode: domId3, bidder: 'dspx' }
        ]
      }
    };
    jsDomWindow.moli = createMoliTag(jsDomWindow);

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
        passbackSupport: true,
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
      auctionId: 'xxxx-xxxx-xxxx-xxxx',
      requestId: 0,
      requestAdsCalls: 1,
      env: 'production',
      logger: { ...noopLogger, error: errorLogSpy },
      config: {
        ...emptyConfig,
        spa: { enabled: true, validateLocation: 'href' }
      },
      runtimeConfig: emptyRuntimeConfig,
      window: jsDomWindow as any,
      // no service dependencies required
      labelConfigService: null as any,
      tcData: fullConsent(),
      adUnitPathVariables: {},
      auction: null as any,
      assetLoaderService: createAssetLoaderService(jsDomWindow)
    };
  };

  it('should not add a configure and prepare request ads pipeline step if disabled', () => {
    const module = new Cleanup();

    module.configure({ cleanup: { enabled: false, configs: [] } });

    const configureSteps = module.configureSteps();
    const prepareRequestAdsSteps = module.prepareRequestAdsSteps();

    expect(configureSteps.length).to.equal(0);
    expect(prepareRequestAdsSteps.length).to.equal(0);
  });

  it('should add a configure and prepare request ads pipeline step', () => {
    const module = createAndConfigureModule({ enabled: true, configs: [] });

    const configureSteps = module.configureSteps();
    const prepareRequestAdsSteps = module.prepareRequestAdsSteps();

    expect(configureSteps.length).to.equal(1);
    expect(prepareRequestAdsSteps.length).to.equal(1);
  });

  it('should not call cleanup if environment is test', async () => {
    const module = createAndConfigureModule({ enabled: true, configs: [] });
    const cleanupSpy = sandbox.spy(module, 'cleanUp');

    const configure = module.configureSteps()[0];
    await configure(
      { ...adPipelineContext(), runtimeConfig: { ...emptyRuntimeConfig, environment: 'test' } },
      []
    );
    expect(cleanupSpy).to.have.not.been.called;

    const prepareRequestAds = module.prepareRequestAdsSteps()[0];
    expect(prepareRequestAds?.name).to.be.eq('cleanup-before-ad-reload');

    await prepareRequestAds(
      { ...adPipelineContext(), runtimeConfig: { ...emptyRuntimeConfig, environment: 'test' } },
      []
    );
    expect(cleanupSpy).to.not.have.been.called;
  });

  it('should remove all elements with the configured CSS selectors from the dom or execute the configured JS in the configure step', async () => {
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

    const configure = module.configureSteps()[0];
    await configure({ ...adPipelineContext() }, slots);

    const specialFormatElementsInDom = [
      ...jsDomWindow.document.querySelectorAll(`.${specialFormatClass1}`),
      ...jsDomWindow.document.querySelectorAll(`.${specialFormatClass2}`)
    ];

    expect(specialFormatElementsInDom).to.have.length(0);
    expect(consoleLogSpy.calledWith(`JS for slot ${domId3} is being executed`)).to.be.true;
  });

  it('should remove the configured element only if the configured slot is reloaded and the corresponding configured bidder has won the last auction', async () => {
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
        }
      ]
    });

    const prepareRequestAds = module.prepareRequestAdsSteps()[0];

    expect(prepareRequestAds?.name).to.be.eq('cleanup-before-ad-reload');
    // only one of the configured slots is reloaded
    await prepareRequestAds({ ...adPipelineContext() }, [createSlotDefinition(domId1)]);

    const specialFormatElementsSeedtagInDom = [
      ...jsDomWindow.document.querySelectorAll(`.${specialFormatClass1}`),
      ...jsDomWindow.document.querySelectorAll(`.${specialFormatClass2}`)
    ];

    // the element that belongs to the configured slot hat was not reloaded should still be in the dom
    expect(specialFormatElementsSeedtagInDom).to.have.length(1);
    expect(specialFormatElementsSeedtagInDom[0].classList.contains(specialFormatClass2)).to.be.true;
  });
  it('should log an error message if the javascript in the deleteMethod is broken and continue without crashing ', async () => {
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

    const configure = module.configureSteps()[0];

    expect(configure?.name).to.be.eq('destroy-out-of-page-ad-format');
    await configure({ ...adPipelineContext() }, slots);

    expect(errorLogSpy.called).to.be.true;
    expect(consoleLogSpy.calledWith(`This is broken`)).to.be.false;
    expect(consoleLogSpy.calledWith(`This is not broken`)).to.be.true;
  });
});
