import { Moli } from '../types/moli';
import SlotDefinition = Moli.SlotDefinition;

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
export type InitStep = () => Promise<void>;

/**
 * ## Configure Step
 *
 * - gpt configuration
 * - prebid configuration
 * - a9 configuration
 * - consent / cmp configuration
 *
 */
export type ConfigureStep = (slots: Moli.AdSlot[]) => Promise<void>;

/**
 * ## Define Slots
 *
 * Create slot definitions
 *
 * - define google ad slots
 * - filter sizes
 *
 */
export type DefineSlotsStep = (slots: Moli.AdSlot[]) => Promise<SlotDefinition<any>[]>;

/**
 * ## Prepare RequestAds
 *
 * Perform actions on slot definitions before we hit google ad manager
 *
 * - prebid requestBids / setGptTargeting
 * - a9 fetchBids
 * - yield optimization
 * - remove stale prebid / a9 key-values
 *
 */
export type PrepareRequestAdsStep = (slots: SlotDefinition<any>[]) => Promise<SlotDefinition<any>[]>;

/**
 * ## RequestAds
 *
 * Fire googletag ad request.
 */
export type RequestAdsStep = (slots: SlotDefinition<any>[]) => Promise<void>;

export interface IAdPiplineConfiguration {

  readonly init: InitStep[];
  readonly configure: ConfigureStep[];
  readonly defineSlots: DefineSlotsStep;
  readonly prepareRequestAds: PrepareRequestAdsStep[];
  readonly requestAds: RequestAdsStep;
}

export class AdPipeline {

  /**
   * the init process should only be called once and we store the result here.
   */
  private init: Promise<void[]> | null = null;

  constructor(private readonly config: IAdPiplineConfiguration, private readonly logger: Moli.MoliLogger) {
  }

  /**
   * run the pipeline
   */
  run(slots: Moli.AdSlot[]): Promise<void> {
    this.init = this.init ? this.init : this.logStage('init').then(() => Promise.all(this.config.init.map(step => step())));

    return this.init
      .then(() => this.logStage('configure').then(() => Promise.all(this.config.configure.map(step => step(slots)))))
      .then(() => this.logStage('defineSlots').then(() => this.config.defineSlots(slots)))
      .then((definedSlots) => {
        return this.logStage('prepareRequestAds')
          .then(() => Promise.all(this.config.prepareRequestAds.map(step => step(definedSlots))))
          .then(() => this.logStage('requestAds'))
          .then(() => this.config.requestAds(definedSlots));
      });
  }

  private logStage(stageName: string): Promise<void> {
    return new Promise<void>(resolve => {
      this.logger.debug('AdPipeline', `stage: ${stageName}`);
    });
  }

}
