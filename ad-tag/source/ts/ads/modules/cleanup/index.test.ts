import * as Sinon from 'sinon';
import { createDom } from '../../../stubs/browserEnvSetup';
import { AdPipelineContext, createMoliTag, Moli } from '../../../../ts/index';
import { emptyConfig, newNoopLogger } from '../../../stubs/moliStubs';
import { Cleanup } from './index';
import { pbjsTestConfig } from '../../../stubs/prebidjsStubs';
import { dummySchainConfig } from '../../../stubs/schainStubs';
import { expect } from 'chai';
import { fullConsent } from '../../../stubs/consentStubs';
import { googletag } from '../../../../ts/index';

import IAdSlot = googletag.IAdSlot;
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

  beforeEach(() => {
    sandbox = Sinon.createSandbox();
    dom = createDom();
    jsDomWindow = dom.window;
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

  const mkConfig = (slots): Moli.MoliConfig => {
    return {
      slots: slots,
      buckets: {
        enabled: true,
        bucket: { lazy_bucket: { timeout: 3000 }, another_lazy_bucket: { timeout: 3000 } }
      },
      logger: noopLogger,
      prebid: { config: pbjsTestConfig, schain: { nodes: [] } },
      schain: dummySchainConfig
    };
  };

  const createAdSlots = (
    window: Window,
    domIds: string[],
    behaviour?: 'eager' | 'manual',
    bucket?: string
  ): Moli.AdSlot[] => {
    return domIds.map(domId => {
      const div = window.document.createElement('div');
      div.id = domId;
      window.document.body.appendChild(div);

      const slot: Moli.AdSlot = {
        domId: domId,
        adUnitPath: domId,
        position: 'in-page',
        sizes: [],
        behaviour: { loaded: behaviour ?? 'manual', bucket: bucket },
        labelAll: [],
        labelAny: [],
        sizeConfig: []
      };
      return slot;
    });
  };

  const createSlotDefinition = (domId: string): Moli.SlotDefinition<Moli.AdSlot> => {
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
      requestId: 0,
      requestAdsCalls: 1,
      env: 'production',
      logger: { ...noopLogger, error: errorLogSpy },
      config: emptyConfig,
      window: jsDomWindow as any,
      // no service dependencies required
      labelConfigService: null as any,
      reportingService: null as any,
      tcData: fullConsent(),
      adUnitPathVariables: {}
      // TODO: add auction context
    };
  };

  it('should add a configure and prepare request ads pipeline step', () => {
    const module = new Cleanup({
      enabled: true,
      configs: [
        {
          bidder: 'Seedtag',
          domId: domId1,
          deleteMethod: {
            cssSelectors: [specialFormatClass1]
          }
        }
      ]
    });

    const slots = createAdSlots(jsDomWindow, [domId1, domId2, domId3]);
    const config = mkConfig(slots);
    module.init(config);

    expect(config.pipeline?.configureSteps.length).to.equal(1);
    expect(config.pipeline?.prepareRequestAdsSteps.length).to.equal(1);
  });

  it('should remove all elements with the configured CSS selectors from the dom or execute the configured JS in the configure step', async () => {
    const module = new Cleanup({
      enabled: true,
      configs: [
        {
          bidder: 'Seedtag',
          domId: domId1,
          deleteMethod: {
            cssSelectors: [`.${specialFormatClass1}`]
          }
        },
        {
          bidder: 'Seedtag',
          domId: domId2,
          deleteMethod: {
            cssSelectors: [`.${specialFormatClass2}`]
          }
        },
        {
          bidder: 'dspx',
          domId: domId3,
          deleteMethod: {
            jsAsString: `context.window.document.querySelectorAll('.${specialFormatClass3}').forEach(element => element.remove());`
          }
        }
      ]
    });
    const slots = createAdSlots(jsDomWindow, [domId1, domId2, domId3]);

    const config = mkConfig(slots);
    module.init(config);
    const configure = config.pipeline?.configureSteps[0];

    if (configure) {
      expect(configure?.name).to.be.eq('destroy-out-of-page-ad-format');
      await configure({ ...adPipelineContext() }, slots);
    }

    const specialFormatElementsInDom = [
      ...jsDomWindow.document.querySelectorAll(`.${specialFormatClass1}`),
      ...jsDomWindow.document.querySelectorAll(`.${specialFormatClass2}`),
      ...jsDomWindow.document.querySelectorAll(`.${specialFormatClass3}`)
    ];

    expect(specialFormatElementsInDom).to.have.length(0);
  });
  it('should remove the configured element only if the configured slot is reloaded and the corresponding configured bidder has won the last auction', async () => {
    const module = new Cleanup({
      enabled: true,
      configs: [
        {
          bidder: 'Seedtag',
          domId: domId1,
          deleteMethod: {
            cssSelectors: [`.${specialFormatClass1}`]
          }
        },
        {
          bidder: 'Seedtag',
          domId: domId2,
          deleteMethod: {
            cssSelectors: [`.${specialFormatClass2}`]
          }
        }
      ]
    });
    const slots = createAdSlots(jsDomWindow, [domId1, domId2]);

    const config = mkConfig(slots);
    module.init(config);
    const prepareRequestAds = config.pipeline?.prepareRequestAdsSteps[0];

    if (prepareRequestAds) {
      expect(prepareRequestAds?.name).to.be.eq('cleanup-before-ad-reload');
      // only one of the configured slots is reloaded
      await prepareRequestAds({ ...adPipelineContext() }, [createSlotDefinition(domId1)]);
    }

    const specialFormatElementsSeedtagInDom = [
      ...jsDomWindow.document.querySelectorAll(`.${specialFormatClass1}`),
      ...jsDomWindow.document.querySelectorAll(`.${specialFormatClass2}`)
    ];

    // the element that belongs to the configured slot hat was not reloaded should still be in the dom
    expect(specialFormatElementsSeedtagInDom).to.have.length(1);
    expect(specialFormatElementsSeedtagInDom[0].classList.contains(specialFormatClass2)).to.be.true;
  });
  it('should log an error message if the javascript in the deleteMethod is broken and continue without crashing ', async () => {
    const module = new Cleanup({
      enabled: true,
      configs: [
        {
          bidder: 'dspx',
          domId: domId1,
          deleteMethod: {
            jsAsString: `context.window.document.querySelctrAll('.${specialFormatClass3}').forEach(element => element.remove());`
          }
        }
      ]
    });
    const slots = createAdSlots(jsDomWindow, [domId1]);
    const config = mkConfig(slots);

    module.init(config);

    const configure = config.pipeline?.configureSteps[0];

    if (configure) {
      expect(configure?.name).to.be.eq('destroy-out-of-page-ad-format');
      await configure({ ...adPipelineContext() }, slots);
    }

    const specialFormatElementsInDom = jsDomWindow.document.querySelectorAll(
      `.${specialFormatClass3}`
    );

    expect(errorLogSpy.called).to.be.true;
    expect(specialFormatElementsInDom).to.have.length(1);
  });
});
