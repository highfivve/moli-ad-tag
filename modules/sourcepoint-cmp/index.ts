import { tcfapi, getLogger } from '@highfivve/ad-tag';
import {
  IModule,
  LOW_PRIORITY,
  mkInitStep,
  mkPrepareRequestAdsStep,
  Moli
} from '@highfivve/ad-tag';

interface ISourcepointConfig {
  /**
   * If true the ad pipeline will be rejected, instead of just logging, as google doesn't provide a cookieless
   * ad manager yet.
   */
  readonly rejectOnMissingPurposeOne: boolean;
}

/**
 * ## Sourcepoint CMP Module
 *
 * ## Requirements
 *
 * - the sourcepoint stub must be loaded before the ad tag.
 *
 */
export default class SourcepointCmp implements IModule {
  public readonly name: string = 'sourcepoint-cmp';
  public readonly description: string = 'IAB compliant CMP';
  public readonly moduleType = 'cmp';

  /**
   * Indicates if the sourcepoint bundle has been loaded
   */
  private readonly consentReady: Promise<void>;

  private readonly spWindow: tcfapi.TCFApiWindow;

  /**
   * This is a temporary workaround until gpt.js understands the tcfapi
   *
   * @see https://support.google.com/admanager/answer/9805023
   */
  private readonly googlePurposes = {
    personalizedAds: [1, 3, 4],
    nonPersonalizedAds: 1
  };

  private logger?: Moli.MoliLogger;

  constructor(private readonly spConfig: ISourcepointConfig, private readonly _window: Window) {
    this.spWindow = (_window as unknown) as tcfapi.TCFApiWindow;

    this.consentReady = new Promise<void>((resolve, reject) => {
      const listener = (event: tcfapi.responses.TCData) => {
        if (event.cmpStatus === 'error') {
          reject(event);
        } else if (event.eventStatus === 'useractioncomplete' || event.eventStatus === 'tcloaded') {
          resolve();
          if (event.listenerId) {
            this.spWindow.__tcfapi(
              'removeEventListener',
              2,
              () => {
                return;
              },
              event.listenerId
            );
          }
        }
      };
      this.spWindow.__tcfapi('addEventListener', 2, listener);
    });
  }

  config(): Object | null {
    return this.spConfig;
  }

  init(config: Moli.MoliConfig): void {
    const log = getLogger(config, this._window);
    this.logger = log;

    // init additional pipeline steps if not already defined
    config.pipeline = config.pipeline || {
      initSteps: [],
      configureSteps: [],
      prepareRequestAdsSteps: []
    };

    // initialize the cmp stub
    config.pipeline.initSteps.push(mkInitStep('cmp-consent-ready', () => this.consentReady));

    config.pipeline.prepareRequestAdsSteps.push(
      mkPrepareRequestAdsStep('cmp-gpt-personalized-ads', LOW_PRIORITY, () =>
        this.getTcData(log).then(tcData => {
          log.debug(this.name, 'gpt setting consent data', tcData, tcData.purpose);

          try {
            const purposeIdsConsented: number[] = Object.entries(tcData.purpose.consents)
              .filter(([_, consent]) => consent)
              .map(([purposeId, _]) => parseInt(purposeId, 10));
            const hasNecessaryPurposeIds = this.googlePurposes.personalizedAds.every(purposeId =>
              purposeIdsConsented.some(purposeIdWithConsent => purposeIdWithConsent === purposeId)
            );
            this._window.googletag
              .pubads()
              .setRequestNonPersonalizedAds(hasNecessaryPurposeIds ? 0 : 1);

            log.debug(
              this.name,
              `gpt setNonPersonalizedAds(${hasNecessaryPurposeIds ? '0' : '1'})`
            );

            if (
              !purposeIdsConsented.some(
                purposeIdWithConsent =>
                  purposeIdWithConsent === this.googlePurposes.nonPersonalizedAds
              )
            ) {
              log.error(this.name, 'No consents for purpose 1. Ad delivery prohibited by Google');
              if (this.spConfig.rejectOnMissingPurposeOne) {
                return Promise.reject(
                  'No consents for purpose 1. Ad delivery prohibited by Google'
                );
              }
            }
          } catch (error) {
            log.error(
              this.name,
              `failed to setNonPersonalizeAds\n${JSON.stringify(tcData)}`,
              error
            );
          }
        })
      )
    );
  }

  private getTcData = (log: Moli.MoliLogger): Promise<tcfapi.responses.TCData> =>
    new Promise(resolve => {
      this.spWindow.__tcfapi('getTCData', 2, (tcData, success: boolean) => {
        log.debug(this.name, 'getTCData returned', success, tcData);
        resolve(tcData);
      });
    });
}
