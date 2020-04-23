import { Moli } from '../types/moli';
import SlotDefinition = Moli.SlotDefinition;

/**
 * Context passed to every pipeline step.
 *
 * Used to inject general purpose external dependencies
 */
export type AdPipelineContext = {
    readonly logger: Moli.MoliLogger;

    /**
     * current environment for the ad pipeline
     */
    readonly env: Moli.Environment;

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
 * Perform actions on slot definitions before we hit google ad manager
 *
 * - prebid requestBids / setGptTargeting
 * - a9 fetchBids
 * - yield optimization
 * - remove stale prebid / a9 key-values
 *
 */
export type PrepareRequestAdsStep = (context: AdPipelineContext, slots: SlotDefinition<any>[]) => Promise<SlotDefinition<any>[]>;

/**
 * ## RequestAds
 *
 * Fire googletag ad request.
 */
export type RequestAdsStep = (context: AdPipelineContext, slots: SlotDefinition<any>[]) => Promise<void>;

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

    constructor(
        private readonly config: IAdPiplineConfiguration,
        private readonly logger: Moli.MoliLogger,
        private readonly env: Moli.Environment,
        private readonly window: Window) {
    }

    /**
     * run the pipeline
     */
    run(slots: Moli.AdSlot[]): Promise<void> {
        const context: AdPipelineContext = {
            logger: this.logger,
            env: this.env,
            window: this.window,
        };
        this.logger.debug('AdPipeline', 'starting run');
        this.init = this.init ? this.init : this.logStage('init').then(() => Promise.all(this.config.init.map(step => step(context))));

        return this.init
            .then(() => this.logStage('configure').then(() => Promise.all(this.config.configure.map(step => step(context, slots)))))
            .then(() => this.logStage('defineSlots').then(() => this.config.defineSlots(context, slots)))
            .then((definedSlots) => {
                return this.logStage('prepareRequestAds')
                    .then(() => Promise.all(this.config.prepareRequestAds.map(step => step(context, definedSlots))))
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
