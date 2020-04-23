import { AdPipelineContext, ConfigureStep, InitStep, PrepareRequestAdsStep } from './adPipeline';
import { Moli } from '../types/moli';
import { AssetLoadMethod, IAssetLoaderService } from '../util/assetLoaderService';

/**
 * Initialize and load the A9 tag.
 *
 * IMPORTANT NOTE:
 * We can't load the A9 script in our <head> as this breaks the complete ad integration.
 * We weren't able to pin down the reason for this behaviour in a meaningful time, so we
 * stick to the current solution, which is also the suggested integration in the A9 docs.
 *
 *
 * @returns {Promise<void>}
 */
export const a9Init = (config: Moli.headerbidding.A9Config, assetService: IAssetLoaderService): InitStep =>
  (context: AdPipelineContext) =>  new Promise<void>(resolve => {
      context.window.apstag = window.apstag || {
      _Q: [],
      init: function (): void {
        window.apstag._Q.push([ 'i', arguments ]);
      },
      fetchBids: function (): void {
        window.apstag._Q.push([ 'f', arguments ]);
      },
      setDisplayBids: function (): void {
        return;
      },
      targetingKeys: function (): void {
        return;
      }
    };

    // async fetch as everything is already initialized
    assetService.loadScript({
      name: 'A9',
      loadMethod: AssetLoadMethod.TAG,
      assetUrl: config.scriptUrl ? config.scriptUrl : '//c.amazon-adsystem.com/aax2/apstag.js'
    });

    resolve();
  });

export const a9Configure = (config: Moli.headerbidding.A9Config): ConfigureStep =>
  (context: AdPipelineContext, slots: Moli.AdSlot[]) => new Promise<void>(resolve => {
    context.window.apstag.init({
      pubID: config.pubID,
      adServer: 'googletag',
      bidTimeout: config.timeout,
      gdpr: {
        cmpTimeout: config.cmpTimeout
      }
    });
    resolve();
  });

export const a9PrepareRequestAds = (config: Moli.headerbidding.A9Config): PrepareRequestAdsStep =>
  (context: AdPipelineContext, slots: Moli.SlotDefinition<any>[]) => new Promise<Moli.SlotDefinition<any>[]>(resolve => {
    resolve();
  });
