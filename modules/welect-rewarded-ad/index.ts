/**
 * Rewarded Ad with Welect
 * @module
 */
import {
  Moli,
  IModule,
  ModuleType,
  mkInitStep,
  AssetLoadMethod,
  IAssetLoaderService,
  AdPipelineContext,
  mkPrepareRequestAdsStep,
  LOW_PRIORITY,
  HIGH_PRIORITY
} from '@highfivve/ad-tag';
import RewardedAdResponse = Moli.RewardedAdResponse;

export type WelectConfig = {
  readonly welectScript: string;
};

/**
 * ## Welect rewarded ad
 */
export class WelectRewardedAd implements IModule {
  public readonly name: string = 'welect-rewardedAd';
  public readonly description: string = 'welect rewarded ad';
  public readonly moduleType: ModuleType = 'creatives';

  private readonly rewardedRefreshButton = '[data-ref="h5v-rewarded-ad-refresh-button"]';
  protected rewardedAdResult: RewardedAdResponse = { status: 'unavailable-ad' };

  constructor(
    private readonly welectConfig: WelectConfig,
    private readonly window: Window & Moli.WelectWindow
  ) {}

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

    config.pipeline.initSteps.push(
      mkInitStep(this.name, ctx => this.loadWelect(ctx, assetLoaderService))
    );

    config.pipeline.prepareRequestAdsSteps.push(
      mkPrepareRequestAdsStep('Rewarded Ad Setup', HIGH_PRIORITY, context => {
        mkInitStep(this.name, ctx => this.loadWelect(ctx, assetLoaderService));

        context.window.googletag.pubads().setTargeting('welect', 'true');
        // register refresh button
        const rewardedAdRefreshBtn = context.window.document.querySelector<HTMLButtonElement>(
          this.rewardedRefreshButton
        );

        if (rewardedAdRefreshBtn) {
          rewardedAdRefreshBtn.addEventListener('click', () => {
            this.refreshRewardedAd().then(result => {
              this.rewardedAdResult = result;
              return result;
            });
          });
        }

        return Promise.resolve();
      })
    );
  }

  private refreshRewardedAd = (): Promise<Moli.RewardedAdResponse> => {
    return new Promise<Moli.RewardedAdResponse>((resolve, reject) => {
      if (this.window.welect.checkAvailability) {
        // Play the Welect dialog

        this.window.welect.checkAvailability({
          onUnavailable: () => {
            resolve({ status: 'unavailable-ad' });
          },
          onAvailable: () => {
            if (this.window.welect.runSession) {
              this.window.welect.runSession({
                // Was the process interrupted by something?
                onAbort: () => {
                  resolve({ status: 'aborted' });
                },
                // Ad view was completely
                onSuccess: () => {
                  // Let`s check the token again
                  if (this.window.welect.checkSession) {
                    this.window.welect.checkSession({
                      // Everything is fine
                      onValid: () => {
                        resolve({ status: 'succeeded' });
                      },
                      // Please contact us in this case
                      onInvalid: () => {
                        reject({ status: 'error' });
                      }
                    });
                  } else {
                    reject({ status: 'error' });
                  }
                }
              });
            }
          }
        });
      }
    });
  };

  loadWelect(context: AdPipelineContext, assetLoaderService: IAssetLoaderService): Promise<void> {
    if (context.config.slots.find(slot => slot.position === 'rewarded')) {
      context.logger.debug(this.name, 'loading welect');
      return assetLoaderService.loadScript({
        name: this.name,
        loadMethod: AssetLoadMethod.TAG,
        assetUrl:
          'https://static.wlt-jupiter.de/p/bundles/1f10ef42-5338-42b5-9797-0283d654ec30.js#wbss'
      });
    }
    return Promise.resolve();
  }
}
