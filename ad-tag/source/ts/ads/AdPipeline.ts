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
type InitStep = () => Promise<void>;

/**
 * ## Configure Step
 *
 * - gpt configuration
 * - prebid configuration
 * - a9 configuration
 * - consent / cmp configuration
 *
 */
type ConfigureStep = (slots: Moli.AdSlot[]) => Promise<void>;

/**
 * ## Define Slots
 *
 * Create slot definitions
 *
 * - define google ad slots
 * - filter sizes
 *
 */
type DefineSlotsStep = (slots: Moli.AdSlot[]) => Promise<SlotDefinition<any>[]>;

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
type PrepareRequestAdsStep = (slots: SlotDefinition<any>[]) => Promise<SlotDefinition<any>[]>;

/**
 * ## RequestAds
 *
 * Fire googletag ad request.
 */
type RequestAdsStep = (slots: SlotDefinition<any>[]) => Promise<void>;

interface IAdPiplineConfiguration {

  readonly init: InitStep[];
  readonly configure: ConfigureStep[];
  readonly defineSlots: DefineSlotsStep;
  readonly prepareRequestAds: PrepareRequestAdsStep[];
  readonly requestAds: RequestAdsStep;
}

class AdPipeline {

  /**
   * the init process should only be called once and we store the result here.
   */
  private init: Promise<void[]> | null = null;

  constructor(private readonly config: IAdPiplineConfiguration) {
  }

  /**
   * run the pipeline
   */
  run(slots: Moli.AdSlot[]): Promise<void> {
    this.init = this.init ? this.init : Promise.all(this.config.init.map(step => step()));

    return this.init
      .then(() => Promise.all(this.config.configure.map(step => step(slots))))
      .then(() => this.config.defineSlots(slots))
      .then((definedSlots) => {
        return Promise.all(this.config.prepareRequestAds.map(step => step(definedSlots)))
          .then(() => this.config.requestAds(definedSlots));
      });
  }

}
