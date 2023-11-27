import { Moli } from '../types/moli';
import { googletag } from '../types/googletag';

/**
 * @internal
 */
type RewardedAd = {
  /**
   * the adUnitPath of the ad slot that should be refreshed.
   * only related to GAM
   */
  readonly adUnitPath: string;

  readonly confirmationMessage?: string;
};

export class RewardedAdService {
  constructor(
    private readonly logger: Moli.MoliLogger,
    private readonly window: Window & googletag.IGoogleTagWindow & Moli.Welect
  ) {}

  private isWelectAvailable = (): boolean => {
    let available = false;
    if (this.window.checkAvailability) {
      this.window.checkAvailability({
        onAvailable: () => {
          available = true;
        },
        onUnavailable: () => null
      });
    }
    return available;
  };

  public refreshRewardedAd = (): Promise<Moli.RewardedAdResponse> => {
    return new Promise<Moli.RewardedAdResponse>((resolve, reject) => {
      // Are there any ads to show?
      if (this.isWelectAvailable() && this.window.runSession) {
        // Play the Welect dialog
        this.window.runSession({
          // Was the process interrupted by something?
          onAbort: () => {
            resolve({ status: 'aborted' });
          },
          // Ad view was completely
          onSuccess: () => {
            // Let`s check the token again
            if (this.window.checkSession) {
              this.window.checkSession({
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
    });
  };
}
