import { ConfigureStep, InitStep, PrepareRequestAdsStep, RequestBidsStep } from '../ads/adPipeline';
import { modules } from './moliConfig';
import { MoliRuntime } from './moliRuntime';

export type ModuleType =
  | 'cmp'
  | 'reporting'
  | 'ad-fraud'
  | 'prebid'
  | 'ad-reload'
  | 'policy'
  | 'identity'
  | 'dmp'
  | 'yield'
  | 'creatives'
  | 'lazy-load';

export interface IModule {
  readonly name: string;
  readonly description: string;
  readonly moduleType: ModuleType;

  /**
   * If the module has some sort of configuration this can be fetched with this method
   */
  config(): Object | null;

  /**
   * Initialize the module with the given module configuration.
   * Depending on the configuration the module may become active or inactive.
   *
   * @param moduleConfig
   */
  configure(moduleConfig?: modules.ModulesConfig): void;

  /**
   * Returns a list of steps that should be executed in the ad pipeline.
   */
  initSteps(): InitStep[];

  /**
   * Returns a list of steps that should be executed in the ad pipeline.
   */
  configureSteps(): ConfigureStep[];

  /**
   * Returns a list of steps that should be executed in the ad pipeline.
   */
  prepareRequestAdsSteps(): PrepareRequestAdsStep[];

  /**
   * Returns a list of steps that should be executed in the ad pipeline.
   *
   * This step is optional, as should have been all steps to reduce implementation complexity of
   * modules.
   *
   * Note: prebid and amazon tam (a9) maybe implemented as modules in the future as they add those
   *       steps to the ad pipeline.
   */
  requestBidsSteps?(): RequestBidsStep[];

  /**
   * This method is called in the bidsBackHandler of prebid.
   *
   * A module may provide those callbacks if it needs to alter the requests send to the ad server.
   * The `auctionEnd` event cannot be used for this, as there's no guarantee the event handler
   * will run before the `requestAds` step.
   *
   * Note: Amazon TAM (A9) also has a callback that could be used for similar things. Unfortunately
   *       does the callback not provide the necessary information to implement any meaningful
   *       business logic. Especially the `cpm` parameter and `bidder`
   *
   * The callback receives additional information coming from the ad pipeline run.
   *
   * Note: These callbacks should not perform any initialization code or only be created once
   *       as this array will be accessed on every pbjs.requestBids() callback.
   *
   * ## Use cases
   *
   * The `generic-skin` module provides prebid bids back handlers to block certain ad units from
   * being requested.
   *
   * @see https://docs.prebid.org/dev-docs/publisher-api-reference/requestBids.html
   * @see https://ams.amazon.com/webpublisher/uam/docs/web-integration-documentation/integration-guide/javascript-guide/api-reference.html#apstagfetchbids
   */
  prebidBidsBackHandler?(): MoliRuntime.PrebidBidsBackHandler[];
}

export type ModuleMeta = Pick<IModule, 'name' | 'description' | 'moduleType'> & {
  config: Object | null;
};
