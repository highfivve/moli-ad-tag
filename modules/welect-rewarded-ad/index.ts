/**
 * Rewarded Ad with Welect
 * @module
 */
import {
  Moli,
  IModule,
  ModuleType,
  AssetLoadMethod,
  IAssetLoaderService,
  AdPipelineContext,
  mkPrepareRequestAdsStep,
  HIGH_PRIORITY,
  mkConfigureStep
} from '@highfivve/ad-tag';

/**
 * ## Welect configuration
 *
 */
export type WelectConfig = {
  /**
   * URL to the welect script that should be loaded
   */
  readonly welectScript: string;
};

/**
 * Welect
 */
interface CheckAvailabilityConfig {
  onAvailable: () => void;
  onUnavailable: () => void;
}

interface RunSessionConfig {
  onSuccess: () => void;
  onAbort: () => void;
}

interface CheckTokenConfig {
  onValid: () => void;
  onInvalid: () => void;
}

export interface WelectWindow {
  readonly welect: Welect;
}

export interface Welect {
  /**
   * Checks if any ads are available.
   */
  checkAvailability?: (config: CheckAvailabilityConfig) => void;

  /**
   * Initiates the Welect overlay with its ad chooser.
   */
  runSession?: (config: RunSessionConfig) => void;

  /**
   * Analyzes the current window if a complete session is present.
   * A user has completed a session when the ad has been viewed till the end.
   *
   * NOTE: the docs state "checkToken", but for us it is "checkSession"
   */
  checkSession?: (config: CheckTokenConfig) => void;

  /**
   * Returns an URL which represents the Welect overlay with its ad
   * chooser.
   */
  startURL?: () => string;
}

/**
 * ## Welect rewarded ad
 */
export class WelectRewardedAd implements IModule {
  public readonly name: string = 'welect-rewardedAd';
  public readonly description: string = 'welect rewarded ad';
  public readonly moduleType: ModuleType = 'creatives';

  private welectWindow: Window & WelectWindow;

  constructor(private readonly welectConfig: WelectConfig, private readonly _window: Window) {
    this.welectWindow = _window as Window & WelectWindow;
  }

  config(): Object | null {
    return this.welectConfig;
  }

  // this is the entry point for the module, it is called by the ad-tag, when the module is loaded
  init(config: Moli.MoliConfig, assetLoaderService: IAssetLoaderService): void {
    // direct prebid events
    // init additional pipeline steps if not already defined
    config.pipeline = config.pipeline || {
      initSteps: [],
      configureSteps: [],
      prepareRequestAdsSteps: []
    };

    config.pipeline.configureSteps.push(
      mkConfigureStep(this.name, (ctx, slots) => this.loadWelect(ctx, slots, assetLoaderService))
    );

    config.pipeline.prepareRequestAdsSteps.push(
      mkPrepareRequestAdsStep('Rewarded Ad Setup', HIGH_PRIORITY, (context, slots) => {
        const rewardedAdSlot = slots.find(slot => slot.moliSlot.position === 'rewarded');

        // only run if there is exactly one slot, and it is a rewarded ad
        // otherwise this is another pipeline run, e.g. for a banner ad
        if (slots.length !== 1 || !rewardedAdSlot) {
          return Promise.resolve();
        }

        return this.requestBids(context.logger).then(bidsAvailable => {
          if (bidsAvailable) {
            // this must trigger a line item in the ad server for welect
            rewardedAdSlot.adSlot.setTargeting('hb_bidder', 'welect');
          }
        });
      })
    );
  }

  private requestBids = (log: Moli.MoliLogger): Promise<boolean> => {
    return new Promise<boolean>(resolve => {
      if (this.welectWindow.welect && this.welectWindow.welect.checkSession) {
        this.welectWindow.welect.checkSession({
          onInvalid: () => {
            log.debug(this.name, 'invalid token');
            resolve(false);
          },
          onValid: () => {
            if (this.welectWindow.welect && this.welectWindow.welect.checkAvailability) {
              this.welectWindow.welect.checkAvailability({
                onUnavailable: () => {
                  log.debug(this.name, 'no ads available');
                  resolve(false);
                },
                onAvailable: () => {
                  log.debug(this.name, 'ads available');
                  resolve(true);
                }
              });
            } else {
              log.debug(this.name, 'valid token, but welect.checkAvailability not available');
              resolve(false);
            }
          }
        });
      } else {
        log.warn(this.name, 'welect not available');
        resolve(false);
      }
    });
  };

  private loadWelect = (
    context: AdPipelineContext,
    slots: Moli.AdSlot[],
    assetLoaderService: IAssetLoaderService
  ): Promise<void> => {
    // welect is already loaded
    if (this.welectWindow.welect) {
      return Promise.resolve();
    }

    // only load welect if a rewarded ad slot is requested
    if (slots.find(slot => slot.position === 'rewarded')) {
      context.logger.debug(this.name, 'loading welect');
      return assetLoaderService.loadScript({
        name: this.name,
        loadMethod: AssetLoadMethod.TAG,
        assetUrl: this.welectConfig.welectScript
      });
    }
    return Promise.resolve();
  };
}
