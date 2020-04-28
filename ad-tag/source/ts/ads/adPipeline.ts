import { Moli } from '../types/moli';
import SlotDefinition = Moli.SlotDefinition;
import { LabelConfigService } from './labelConfigService';
import { ReportingService } from './reportingService';
import { SlotEventService } from "./slotEventService";

/**
 * Context passed to every pipeline step.
 *
 * Used to inject general purpose external dependencies
 */
export type AdPipelineContext = {
  /**
   * an incremented id that identifies a pipeline run
   */
  readonly requestId: number;


  readonly logger: Moli.MoliLogger;

  /**
   * current environment for the ad pipeline
   */
  readonly env: Moli.Environment;

  /**
   * required for filtering based on labels
   */
  readonly labelConfigService: LabelConfigService;

  /**
   * enables steps to access the reporting API
   */
  readonly reportingService: ReportingService;

  /**
   * access to the slot event service API
   */
  readonly slotEventService: SlotEventService;

  /**
   * access to the global window. Never access the global window object
   */
  readonly window: Window;
};

/**
 * ## Init Step
 *
 * - domReady
 * - gpt ready
 * - prebid ready
 * - a9 fetch js
 * - async fetching of external resources
 *
 */
export type InitStep = (context: AdPipelineContext) => Promise<void>;

/**
 * ## Configure Step
 *
 * - gpt configuration
 * - prebid configuration
 * - a9 configuration
 * - consent / cmp configuration
 *
 */
export type ConfigureStep = (context: AdPipelineContext, slots: Moli.AdSlot[]) => Promise<void>;

/**
 * ## Define Slots
 *
 * Create slot definitions
 *
 * - define google ad slots
 * - filter sizes
 *
 */
export type DefineSlotsStep = (context: AdPipelineContext, slots: Moli.AdSlot[]) => Promise<SlotDefinition<any>[]>;

/**
 * ## Prepare RequestAds
 *
 * This phase configures external systems such as prebid and a9 or and prepares
 * the existing google ad slots for a request.
 *
 * - add prebid ad units
 * - add a9 ad units
 * - yield optimization
 * - remove stale prebid / a9 key-values
 *
 */
export type PrepareRequestAdsStep = (context: AdPipelineContext, slots: SlotDefinition<Moli.AdSlot>[]) => Promise<SlotDefinition<any>[]>;

/**
 * ## Request Bids
 *
 * Make calls to 3rd party systems to fetch bids.
 *
 * This is the last step where we can perform actions on slot definitions before we hit google ad manager.
 *
 * - prebid requestBids / setGptTargeting
 * - a9 fetchBids
 */
export type RequestBidsStep = (context: AdPipelineContext, slots: SlotDefinition<Moli.AdSlot>[]) => Promise<void>;

/**
 * ## RequestAds
 *
 * Fire googletag ad request.
 */
export type RequestAdsStep = (context: AdPipelineContext, slots: SlotDefinition<Moli.AdSlot>[]) => Promise<void>;

export interface IAdPiplineConfiguration {

  readonly init: InitStep[];
  readonly configure: ConfigureStep[];
  readonly defineSlots: DefineSlotsStep;
  readonly prepareRequestAds: PrepareRequestAdsStep[];
  readonly requestBids: RequestBidsStep[];
  readonly requestAds: RequestAdsStep;
}

export class AdPipeline {

  /**
   * the init process should only be called once and we store the result here.
   */
  private init: Promise<void[]> | null = null;

  private requestId: number = 0;

  constructor(
    private readonly config: IAdPiplineConfiguration,
    private readonly logger: Moli.MoliLogger,
    private readonly env: Moli.Environment,
    private readonly window: Window,
    private readonly reportingService: ReportingService,
    private readonly slotEventService: SlotEventService
    ) {
  }

  /**
   * run the pipeline
   */
  run(slots: Moli.AdSlot[], config: Moli.MoliConfig): Promise<void> {
    const extraLabels = config.targeting && config.targeting.labels ? config.targeting.labels : [];
    const labelConfigService = new LabelConfigService(config.labelSizeConfig || [], extraLabels, this.window);

    // increase the prebid request count
    this.requestId = this.requestId + 1;
    const currentRequestId = this.requestId;

    const context: AdPipelineContext = {
      requestId: currentRequestId,
      logger: this.logger,
      env: this.env,
      labelConfigService: labelConfigService,
      reportingService: this.reportingService,
      slotEventService: this.slotEventService,
      window: this.window
    };
    this.logger.debug('AdPipeline', `starting run ${currentRequestId}`);
    this.init = this.init ? this.init : this.logStage('init').then(() => Promise.all(this.config.init.map(step => step(context))));

    return this.init
      .then(() => this.logStage('configure').then(() => Promise.all(this.config.configure.map(step => step(context, slots)))))
      .then(() => this.logStage('defineSlots').then(() => this.config.defineSlots(context, slots)))
      .then((definedSlots) => {
        return this.logStage('prepareRequestAds')
          .then(() => Promise.all(this.config.prepareRequestAds.map(step => step(context, definedSlots))))
          .then(() => this.logStage('requestBids'))
          // TODO add a general timeout for the requestBids call
          // TODO add a catch call to not break the request chain
          .then(() => Promise.all(this.config.requestBids.map(step => step(context, definedSlots))))
          .then(() => this.logStage('requestAds'))
          .then(() => this.config.requestAds(context, definedSlots));
      }).catch(error => {
        this.logger.error('AdPipeline', 'running ad pipeline failed with error', error);
        return Promise.reject(error);
      });
  }

  private logStage(stageName: string): Promise<void> {
    return new Promise<void>(resolve => {
      this.logger.debug('AdPipeline', `stage: ${stageName}`);
      resolve();
    });
  }

}
