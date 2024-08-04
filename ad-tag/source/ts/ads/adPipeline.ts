import { MoliRuntime } from '../types/moliRuntime';
import { LabelConfigService } from './labelConfigService';
import { apstag } from '../types/apstag';
import { tcfapi } from '../types/tcfapi';
import { consentReady } from './consent';
import { googletag } from '../types/googletag';
import { prebidjs } from '../types/prebidjs';
import TCPurpose = tcfapi.responses.TCPurpose;
import { AdUnitPathVariables, generateAdUnitPathVariables } from './adUnitPath';
import { GlobalAuctionContext } from './globalAuctionContext';
import { AdSlot, bucket, consent, Environment, MoliConfig } from '../types/moliConfig';
import { IAssetLoaderService, createAssetLoaderService } from '../util/assetLoaderService';
import { uuidV4 } from '../util/uuid';

/**
 * Context passed to every pipeline step.
 *
 * Used to inject general purpose external dependencies
 */
export type AdPipelineContext = {
  /**
   * Unique auction id for the current ad pipeline run.
   *
   * It can be used to associate a pipeline run with events, e.g. the `auctionInit` or `auctionEnd`
   * event from prebid.
   */
  readonly auctionId: string;

  /**
   * an incremented id that identifies a pipeline run.
   *
   * Starts with 1 and increments by one for each pipeline run.
   */
  readonly requestId: number;

  /**
   * A counter for requestAds() calls.
   *
   * This is only useful for steps that should run only once in single page application mode.
   * For server side rendered pages this is always 1.
   *
   */
  readonly requestAdsCalls: number;

  readonly logger: MoliRuntime.MoliLogger;

  /**
   * Environment from the config with a default set to production
   */
  readonly env: Environment;

  /**
   * The config used for the ad configuration run
   */
  readonly config: MoliConfig;
  /**
   * The runtime config. It contains all values that have been set through the javascript API
   */
  readonly runtimeConfig: MoliRuntime.MoliRuntimeConfig;

  /**
   * required for filtering based on labels
   */
  readonly labelConfigService: LabelConfigService;

  /**
   * access to the global window. Never access the global window object
   */
  readonly window: Window &
    apstag.WindowA9 &
    googletag.IGoogleTagWindow &
    prebidjs.IPrebidjsWindow &
    tcfapi.TCFApiWindow &
    MoliRuntime.MoliWindow;

  /**
   * consent data
   */
  readonly tcData: tcfapi.responses.TCData;

  /**
   * bucket config
   */
  readonly bucket?: bucket.BucketConfig | null;

  /**
   * Contains the ad unit path variables set in the moli config, enhanced with
   * the dynamic values generated from the ad tag.
   */
  readonly adUnitPathVariables: AdUnitPathVariables;

  /**
   * Access to global auction for auction optimizations.
   * If not set, the global auction context is undefined
   */
  readonly auction: GlobalAuctionContext;

  /**
   * Takes care of loading (external) assets
   */
  readonly assetLoaderService: IAssetLoaderService;
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
 *
 */
export type ConfigureStep = (context: AdPipelineContext, slots: AdSlot[]) => Promise<void>;

/**
 * ## Define Slots
 *
 * Create slot definitions
 *
 * - define google ad slots
 * - filter sizes
 *
 */
export type DefineSlotsStep = (
  context: AdPipelineContext,
  slots: AdSlot[]
) => Promise<MoliRuntime.SlotDefinition[]>;

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
export type PrepareRequestAdsStep = {
  (context: AdPipelineContext, slots: MoliRuntime.SlotDefinition[]): Promise<unknown>;

  /**
   * higher number means higher priority means runs before lower priorties
   */
  readonly priority: number;
};

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
export type RequestBidsStep = (
  context: AdPipelineContext,
  slots: MoliRuntime.SlotDefinition[]
) => Promise<void>;

/**
 * ## RequestAds
 *
 * Fire googletag ad request.
 */
export type RequestAdsStep = (
  context: AdPipelineContext,
  slots: MoliRuntime.SlotDefinition[]
) => Promise<void>;

export interface IAdPipelineConfiguration {
  readonly init: InitStep[];
  readonly configure: ConfigureStep[];
  readonly defineSlots: DefineSlotsStep;
  readonly prepareRequestAds: PrepareRequestAdsStep[];
  readonly requestBids: RequestBidsStep[];
  readonly requestAds: RequestAdsStep;
}

export const HIGH_PRIORITY = 100;
export const LOW_PRIORITY = 10;

export const mkInitStep = (
  name: string,
  fn: (context: AdPipelineContext) => Promise<void>
): InitStep => {
  Object.defineProperty(fn, 'name', { value: name });
  return fn;
};

export const mkConfigureStep = (
  name: string,
  fn: (context: AdPipelineContext, slots: AdSlot[]) => Promise<void>
): ConfigureStep => {
  Object.defineProperty(fn, 'name', { value: name });
  return fn;
};

/**
 * Construct configure steps that only run once per requestAds call.
 * This is only useful for single page application
 *
 * ## Use cases
 *
 * Cleanup on new page, e.g. remove previous ad slots or targeting.
 *
 * @param name
 * @param fn
 */
export const mkConfigureStepOncePerRequestAdsCycle = (
  name: string,
  fn: (context: AdPipelineContext, slots: AdSlot[]) => Promise<void>
): ConfigureStep => {
  Object.defineProperty(fn, 'name', { value: name });
  let currentRequestAdsCalls = 0;

  return mkConfigureStep(name, (context, slots) => {
    if (currentRequestAdsCalls !== context.requestAdsCalls) {
      currentRequestAdsCalls = context.requestAdsCalls;
      return fn(context, slots);
    } else {
      return Promise.resolve();
    }
  });
};

/**
 * Construct configure steps that only run once.
 * This is only useful for single page application.
 *
 * ## Use cases
 *
 * Something that should only be configured once, but requires something
 * from the init step, e.g. "identity providers" but the command que must
 * be present.
 *
 * @param name
 * @param fn
 */
export const mkConfigureStepOnce = (
  name: string,
  fn: (context: AdPipelineContext, slots: AdSlot[]) => Promise<void>
): ConfigureStep => {
  Object.defineProperty(fn, 'name', { value: name });

  return mkConfigureStep(name, (context, slots) =>
    context.requestAdsCalls === 1 && context.requestId === 1
      ? fn(context, slots)
      : Promise.resolve()
  );
};

export const mkPrepareRequestAdsStep = (
  name: string,
  priority: number,
  fn: (context: AdPipelineContext, slots: MoliRuntime.SlotDefinition[]) => Promise<void>
): PrepareRequestAdsStep => {
  const step = Object.assign(fn, { priority: priority });
  Object.defineProperty(fn, 'name', { value: name });
  return step;
};

export const mkRequestBidsStep = (
  name: string,
  fn: (context: AdPipelineContext, slots: MoliRuntime.SlotDefinition[]) => Promise<void>
): RequestBidsStep => {
  Object.defineProperty(fn, 'name', { value: name });
  return fn;
};

export class AdPipeline {
  /**
   * the init process should only be called once and we store the result here.
   */
  private init: Promise<void[]> | null = null;

  private tcData: Promise<tcfapi.responses.TCData> | null = null;

  private requestId: number = 0;

  /**
   *
   * @param config public available for testing and building APIs for configuration from outside
   * @param logger
   * @param window
   * @param auction
   */
  constructor(
    public readonly config: IAdPipelineConfiguration,
    private readonly logger: MoliRuntime.MoliLogger,
    private readonly window: Window &
      googletag.IGoogleTagWindow &
      prebidjs.IPrebidjsWindow &
      MoliRuntime.MoliWindow,
    private readonly auction: GlobalAuctionContext
  ) {}

  /**
   * run the pipeline
   */
  run(
    slots: AdSlot[],
    config: MoliConfig,
    runtimeConfig: MoliRuntime.MoliRuntimeConfig,
    requestAdsCalls: number,
    bucketName?: string
  ): Promise<void> {
    if (slots.length === 0) {
      return Promise.resolve();
    }

    // increase the prebid request count
    this.requestId = this.requestId + 1;
    const currentRequestId = this.requestId;
    const auctionId = uuidV4(this.window);

    this.logger.debug(
      'AdPipeline',
      `starting run with requestId ${currentRequestId} on ${requestAdsCalls}. call. AuctionId ${auctionId}`,
      slots
    );

    // fetch the consent data when ready
    const consentConfig: consent.ConsentConfig = config.consent || {};
    this.tcData = this.tcData
      ? this.tcData
      : consentReady(consentConfig, this.window, this.logger, runtimeConfig.environment);

    return this.tcData.then(consentData => {
      const extraLabels = [...(config.targeting?.labels || []), ...runtimeConfig.labels];

      // purpose 1: storing information on the user device (cookie, localstorage, etc)
      // this labels main purpose is to be able to only enable prebid partners that treat this correctly
      if (
        consentData.gdprApplies &&
        consentData.purpose.consents[TCPurpose.STORE_INFORMATION_ON_DEVICE]
      ) {
        extraLabels.push('purpose-1');
      } else if (!consentData.gdprApplies) {
        extraLabels.push('purpose-1');
      }

      const labelConfigService = new LabelConfigService(
        config.labelSizeConfig || [],
        extraLabels,
        this.window
      );

      const bucketConfig =
        bucketName && config.buckets?.bucket && config.buckets.bucket[bucketName]
          ? config.buckets.bucket[bucketName]
          : null;

      const adUnitPathVariables = generateAdUnitPathVariables(
        this.window.location.hostname,
        labelConfigService.getDeviceLabel(),
        config.targeting?.adUnitPathVariables,
        config.domain
      );

      // the context is based on the consent data
      const context: AdPipelineContext = {
        auctionId: auctionId,
        requestId: currentRequestId,
        requestAdsCalls: requestAdsCalls,
        logger: this.logger,
        env: runtimeConfig.environment || 'production',
        config: config,
        runtimeConfig: runtimeConfig,
        labelConfigService: labelConfigService,
        window: this.window,
        tcData: consentData,
        bucket: bucketConfig,
        adUnitPathVariables: adUnitPathVariables,
        auction: this.auction,
        assetLoaderService: createAssetLoaderService(this.window)
      };

      this.init = this.init
        ? this.init
        : this.logStage('init', currentRequestId).then(() =>
            Promise.all(this.config.init.map(step => step(context)))
          );

      const REJECTED_NO_SLOTS_AFTER_FILTERING = 'rejected-no-slots-after-filtering';

      return this.init
        .then(() =>
          this.logStage('configure', currentRequestId).then(() =>
            Promise.all(this.config.configure.map(step => step(context, slots)))
          )
        )
        .then(() =>
          this.logStage('defineSlots', currentRequestId).then(() =>
            this.config.defineSlots(context, slots)
          )
        )
        .then(definedSlots => {
          if (!definedSlots.length) {
            return Promise.reject(REJECTED_NO_SLOTS_AFTER_FILTERING);
          }

          return (
            this.logStage('prepareRequestAds', currentRequestId)
              .then(() => this.runPrepareRequestAds(context, definedSlots))
              .then(() => this.logStage('requestBids', currentRequestId))
              // TODO add a catch call to not break the request chain
              .then(() =>
                Promise.all(this.config.requestBids.map(step => step(context, definedSlots)))
              )
              .then(() => this.logStage('requestAds', currentRequestId))
              .then(() => this.config.requestAds(context, definedSlots))
          );
        })
        .catch(error => {
          switch (error) {
            case REJECTED_NO_SLOTS_AFTER_FILTERING:
              return Promise.resolve();
            default:
              this.logger.error('AdPipeline', 'running ad pipeline failed with error', error);
              return Promise.reject(error);
          }
        });
    });
  }

  // for testing purposes
  getAuction(): GlobalAuctionContext | undefined {
    return this.auction;
  }

  private runPrepareRequestAds = (
    context: AdPipelineContext,
    definedSlots: MoliRuntime.SlotDefinition[]
  ) => {
    const byPriority = new Map<number, PrepareRequestAdsStep[]>();
    this.config.prepareRequestAds.forEach(step => {
      const steps = byPriority.get(step.priority);
      if (steps) {
        steps.push(step);
      } else {
        byPriority.set(step.priority, [step]);
      }
    });

    return (
      Array.from(byPriority.entries())
        // order by priority. Higher priorities first
        .sort(([prio1], [prio2]) => (prio1 > prio2 ? -1 : 1))
        // reduce to a single promise by chaining in order of priority
        .reduce((prevSteps, [priority, steps]) => {
          return prevSteps.then(() => {
            context.logger.debug(
              'AdPipeline',
              context.requestId,
              `run prepareRequestAds with priority ${priority}`
            );
            return Promise.all(steps.map(step => step(context, definedSlots)));
          });
        }, Promise.resolve<unknown>(undefined))
    );
  };

  private logStage(stageName: string, requestId: number): Promise<void> {
    return new Promise<void>(resolve => {
      this.logger.debug('AdPipeline', requestId, `stage: ${stageName}`);
      resolve();
    });
  }
}
