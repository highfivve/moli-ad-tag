import {
  IModule,
  ModuleType,
  Moli,
  getLogger,
  IAssetLoaderService,
  mkPrepareRequestAdsStep,
  mkInitStep, LOW_PRIORITY
} from '@highfivve/ad-tag';

// @ts-ignore
// liveramp doesn't work with the standardize `@iabtcf/stub`
import * as cmpstub from './liverampStub';
import { responses, TCFApiWindow } from './types/tcfapi';

/**
 *
 * Check consent for a specific vendor
 * ```js
 * window.__tcfapi('checkConsent', 2, (isValid) => console.log('isValid', isValid), { data: { vendorId: 32 }})
 * ```
 */
export default class LiveRampCmp implements IModule {

  public readonly name: string = 'Generic CMP';
  public readonly description: string = 'TCF 2.0 compatible CMP integration';

  public readonly moduleType: ModuleType = 'cmp';

  private readonly tcfapiWindow: TCFApiWindow;

  /**
   * This is a temporary workaround until gpt.js understands the tcfapi
   *
   * @see https://support.google.com/admanager/answer/9805023
   */
  private readonly googlePurposes = {
    personalizedAds: [1, 3, 4],
    nonPersonalizedAds: 1
  };

  constructor(private readonly _window: Window) {
    this.tcfapiWindow = this._window as unknown as TCFApiWindow;
  }

  config(): Object | null {
    return null;
  }

  // warnings found: Invalid CMP config values not applied: restrictForEU

  init(config: Moli.MoliConfig, assetLoaderService: IAssetLoaderService): void {
    const log = getLogger(config, this._window);

    if (config.environment === 'test') {
      log.debug(this.name, 'ad tag in test mode. Blacklist module is disabled');
      return;
    }

    // init additional pipeline steps if not already defined
    config.pipeline = config.pipeline || {
      initSteps: [],
      configureSteps: [],
      prepareRequestAdsSteps: []
    };

    // initialize the cmp stub
    config.pipeline.initSteps.push(mkInitStep(
      'cmp-stub',
      () => this.initStub(log)
        .then(() => this.pingUntilReady(log))
        .then(() => this.getTcData(log))
        .then(tcData => {
          if (!tcData.gdprApplies) {
            log.warn(this.name, 'CMP thinks GDPR does not apply. But it should!');
          }
          return tcData;
        })
        .then((tcData) => tcData.eventStatus === 'cmpuishown' ? this.awaitConsent(log) : Promise.resolve())
    ));

    config.pipeline.prepareRequestAdsSteps.push(mkPrepareRequestAdsStep('gpt-personalized-ads', LOW_PRIORITY, () => this.getTcData(log).then(tcData => {
      log.debug(this.name, 'gpt setting consent data', tcData, tcData.purpose);

      const purposeIdsConsented: number[] = Object.entries(tcData.purpose.consents)
        .filter(([_, consent]) => consent)
        .map(([purposeId, _]) => parseInt(purposeId, 10));
      const hasNecessaryPurposeIds = this.googlePurposes.personalizedAds
        .every(purposeId => purposeIdsConsented.some(purposeIdWithConsent => purposeIdWithConsent === purposeId));
      this._window.googletag.pubads().setRequestNonPersonalizedAds(hasNecessaryPurposeIds ? 0 : 1);

      if (!purposeIdsConsented.some(purposeIdWithConsent => purposeIdWithConsent === this.googlePurposes.nonPersonalizedAds)) {
        log.error(this.name, 'No consents for purpose 1. Ad delivery prohibited by Google');
      }

    })));
  }

  private initStub = (log: Moli.MoliLogger): Promise<void> => new Promise<void>(resolve => {
    if (!this.tcfapiWindow.__tcfapi) {
      log.debug(this.name, 'initialize stub');
      cmpstub();
    } else {
      log.debug(this.name, 'no stub required');
    }
    resolve();
  });

  private pingUntilReady = (log: Moli.MoliLogger): Promise<void> => new Promise<void>(resolve => {
    log.debug(this.name, 'ping until cmp ready via long polling');

    const resolveIfReady = () => this.tcfapiWindow.__tcfapi('ping', 2, (ping: responses.Ping) => {
      log.debug(this.name, 'ping response', ping);
      // IMPORTANT: the cmpLoaded flag is in sync with the cmpStatus in the current liveramp implementation
      if (ping.cmpStatus === 'loaded') {
        log.debug(this.name, 'cmp ready', ping);
        resolve();
      } else {
        setTimeout(resolveIfReady, 100);
      }
    });

    resolveIfReady();
  });


  private getTcData = (log: Moli.MoliLogger): Promise<responses.TCData> => new Promise(resolve => {
    this.tcfapiWindow.__tcfapi('getTCData', 2, (tcData, success: boolean) => {
      log.debug(this.name, 'getTCData returned', success, tcData);
      resolve(tcData);
    });
  });

  private awaitConsent = (log: Moli.MoliLogger): Promise<void> => new Promise(resolve => {
    log.debug(this.name, 'add event listener for first interaction');
    this.tcfapiWindow.__tcfapi('addEventListener', 2, (tcData, success: boolean) => {
      log.debug(this.name, 'received updated tcData', success, tcData.eventStatus, tcData);
      if (success && tcData.eventStatus === 'useractioncomplete') {
        resolve();
        this.tcfapiWindow.__tcfapi('removeEventListener', 2, (success: boolean) => {
          log.debug(this.name, 'removed init event listener', success);
        }, tcData.listenerId!);
      }
    });
  });

}
