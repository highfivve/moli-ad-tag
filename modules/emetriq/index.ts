/**
 * # Emetriq data collection module ([-> Docs](https://doc.emetriq.de/#/profiling/adp/data-providers-client)
 *
 * This module provides Emetriq data collection functionality to Moli.
 *
 * ## Integration
 *
 * In your `index.ts`, import Emetriq and register the module.
 *
 * ```js
 * import { Emetriq } from '@highfivve/module-emetriq';
 *
 * moli.registerModule(
 *   new Emetriq({
 *     sid: 1337,
 *     yob: '2001',
 *     custom1: 'IAB1,IAB1-2',
 *     id_sharedid: '7338305e-6779-4239-9d3b-897730521992'
 *   })
 * );
 * ```
 *
 * Configure the module with:
 *
 * - your Emetriq `sid`
 * - additional fields such as
 *   - yob, zip or gender
 *   - custom1, custom2, custom3, ...
 *   - id_id5, id_liveramp, ...
 *
 * @module
 */
import {
  AdPipelineContext,
  AssetLoadMethod,
  IAssetLoaderService,
  IModule,
  mkInitStep,
  ModuleType,
  Moli
} from '@highfivve/ad-tag';
import { EmetriqParams, EmetriqWindow } from './types/emetriq';

/**
 * # Emetriq Module
 *
 * This module provides Emetriq data collection functionality to Moli.
 *
 * @see https://doc.emetriq.de/#/profiling/adp/data-providers-client
 */
export class Emetriq implements IModule {
  public readonly name: string = 'emetriq';
  public readonly description: string = 'Provides Emetriq data collection functionality to Moli.';
  public readonly moduleType: ModuleType = 'dmp';

  private readonly _enqAdpParam: EmetriqParams;
  private readonly window: EmetriqWindow;

  private readonly gvlid: string = '213';

  constructor(private readonly moduleConfig: EmetriqParams, window: Window) {
    this.window = window as EmetriqWindow;

    this._enqAdpParam = moduleConfig;
  }

  config(): EmetriqParams {
    return this.moduleConfig;
  }

  init(config: Moli.MoliConfig, assetLoaderService: IAssetLoaderService): void {
    // init additional pipeline steps if not already defined
    config.pipeline = config.pipeline || {
      initSteps: [],
      configureSteps: [],
      prepareRequestAdsSteps: []
    };

    config.pipeline.initSteps.push(
      mkInitStep(this.name, ctx => {
        this.loadEmetriq(ctx, assetLoaderService);
        return Promise.resolve();
      })
    );
  }

  loadEmetriq(context: AdPipelineContext, assetLoaderService: IAssetLoaderService): Promise<void> {
    // test environment doesn't require confiant
    if (context.env === 'test') {
      return Promise.resolve();
    }

    // no consent
    if (context.tcData.gdprApplies && !context.tcData.vendor.consents[this.gvlid]) {
      return Promise.resolve();
    }

    this.window._enqAdpParam = this._enqAdpParam;

    return assetLoaderService.loadScript({
      name: this.name,
      loadMethod: AssetLoadMethod.TAG,
      assetUrl: `https://ups.xplosion.de/loader/${this.moduleConfig.sid}/default.js`
    });
  }
}
