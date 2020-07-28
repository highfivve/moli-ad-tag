import { getLogger } from '@highfivve/ad-tag/source/ts/util/logging';
import { tcfapi } from '@highfivve/ad-tag';
import { IModule, LOW_PRIORITY, mkInitStep, mkPrepareRequestAdsStep, Moli } from '@highfivve/ad-tag';

type SourcepointWindow = tcfapi.TCFApiWindow & {
  _sp_: {
    config: ISourcepointWindowConfig
  }
};

export interface ISourcepointWindowConfig {
  readonly accountId: number;

  /**
   * "https://cdn.privacy-mgmt.com" is a single server endpoint from where the messaging as well as the GDPR and
   * TCFv2 experience is served. The baseEndpoint can also be changed to a CNAMED 1st party subdomain in order
   * to persist 1st party cookies on Safari web browser (due to Safari’s ITP) by setting cookies through the server
   * with "set-cookie" rather than using "document.cookie" on the page. Changing the baseEndpoint domain is optional
   * but recommended!
   *
   * @see [[https://documentation.sourcepoint.com/cmp/configurations/setting-up-the-cname-dns-record-for-single-cname]]
   */
  readonly baseEndpoint: string;

  /**
   * Maps the implementation to a specific URL as set up in the Sourcepoint account dashboard
   */
  readonly propertyHref?: string;

  /**
   *  Maps the message to a specific property (website, app, OTT) as set up in Sourcepoint account dashboard
   */
  readonly propertyId?: number;

  /**
   * This parameter enables you to create key-value pairs that can be used for targeting in the scenario builder
   * in the Sourcepoint dashboard.
   */
  readonly targetingParams?: {
    [key: string]: string
  };

  readonly events?: IEventCallbacks;
}

interface IMessageReceivedData {
  /** e.g. "https://notice.sp-prod.net?message_id=12345", */
  readonly message_url: string;

  /** e.g. "12345" */
  readonly msg_id: string;

  /** e.g. "6e769cbb-0adc-4ac2-b91c-743075736169" */
  readonly prtn_uuid: string;

  /** "Consent Message 9.20.2019" */
  readonly msg_desc: string;

  /** e.g. "39599" */
  readonly cmpgn_id: string;

  /** e.g. "49" */
  readonly bucket: string;

  /** e.g. "fa3db7d9-3258-46f1-8386-97ce2b4a5249" */
  readonly uuid: string;

}

interface IPrivacyManagerData {
  readonly purposeConsent: string;
  readonly vendorConsent: string;
}

export enum ChoiceTypeId {
  /** The user has chosen to view instructions on how to whitelist a site */
  HOW_TO_WHITELIST = 1,

  /** The user has chosen to opt into ad recovery (no longer used) */
  AD_RECOVERY = 2,

  /** The user has chosen to view a directly sold video instead of disabling adblockers (requires a separate agreement) */
  AD_RECOVERY_VIDEO = 3,

  /** The user has chosen to view custom content in an iframe */
  CUSTOM_CONTENT = 4,

  /** The user has chosen a option to redirect to another page */
  REDIRECT = 5,

  /** The user has chosen to continue with adblockers enabled */
  CONTINUE_WITH_ADBLOCKER = 6,

  /** The user has chosen a micropayment option (requires a separate agreement) */
  MICRO_PAYMENT = 7,

  /** The user has selected an option tied to custom javascript on the site page */
  CUSTOM_JS = 9,

  /** The user has chosen to view a video provided by Welect (requires a separate agreement) */
  AD_RECOVERY_WELECT = 10,

  /** The user has chosen the "Accept All" option in a consent message */
  ACCEPT_ALL = 11,

  /** The user has chosen to view a privacy manager (consent preferences) UI.c */
  CONSENT_PREFERENCES = 12,

  /** The user has chosen the "Reject All" message from a consent message */
  REJECT_ALL = 13,

  /** Samba Video (requires separate agreement with Samba and Sourcepoint) */
  AD_RECOVERY_SAMBA = 14,

  /** Dismiss button */
  DISMISS_BUTTON
}

interface IEventCallbacks {
  /**
   * this event fires when a message is about to display.
   */
  readonly onMessageReady?: () => void;

  /**
   * this event fires when a call-to-action button in a message has been clicked. The receives two integers.
   * The first is the choice_id and it represents the id value of the choice selected that is specific to that choice.
   * The second is the choice_type_id which is the ID of the type of choice clicked. A table of the choice type IDs is below.
   */
  readonly onMessageChoiceSelect?: (choiceId: number, choiceTypeId: ChoiceTypeId) => void;

  /**
   * his event fires when a button in a privacy manager has been clicked on. The data sent to the callback has the
   * structure below with possible values for purposeConsent and vendorConsent being some, none or all. The value
   * for the vendorList is returned undefined at this point in time
   */
  readonly onPrivacyManagerAction?: (pmData: IPrivacyManagerData) => void;

  /**
   * this event fires when there was an error in the message delivery process.
   * A brief description of the error is returned
   */
  readonly onMessageChoiceError?: (err: any) => void;

  /**
   * this event fires when the consent object is ready. The consentUUID and euconsent values are sent to the callback
   */
  readonly onConsentReady?: (consentUUID: string, euconsent: any) => void;


  /**
   * this event fires when a user hits the cancel button of the privacy manager.
   */
  readonly onPMCancel?: () => void;

  /**
   *  this event fires when a message is displayed to the user and sends data about the message and campaign to the callback
   */
  readonly onMessageReceiveData?: (data: IMessageReceivedData) => void;

  /**
   * this event fires when the privacy manager is ready to be displayed on the page. It can be used to notify on-page
   * functions that the privacy manager is now available to be displayed using the Sourcepoint plug and play javascript code
   */
  readonly onSPPMObjectReady?: () => void;
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

  private readonly spWindow: SourcepointWindow;

  /**
   * This is a temporary workaround until gpt.js understands the tcfapi
   *
   * @see https://support.google.com/admanager/answer/9805023
   */
  private readonly googlePurposes = {
    personalizedAds: [ 1, 3, 4 ],
    nonPersonalizedAds: 1
  };

  private logger?: Moli.MoliLogger;

  constructor(private readonly _window: Window) {
    this.spWindow = _window as unknown as SourcepointWindow;

    this.consentReady = new Promise<void>((resolve, reject) => {
      const listener = (event: tcfapi.responses.TCData) => {
        if (event.cmpStatus === 'error') {
          reject(event);
        } else if (event.eventStatus === 'useractioncomplete' || event.eventStatus === 'tcloaded') {
          resolve();
          if (event.listenerId) {
            this.spWindow.__tcfapi('removeEventListener', 2, () => {
              return;
            }, event.listenerId);
          }
        }
      };
      this.spWindow.__tcfapi('addEventListener', 2, listener);
    });
  }

  config(): Object | null {
    return null;
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
    config.pipeline.initSteps.push(mkInitStep(
      'cmp-consent-ready',
      () => this.consentReady
    ));

    config.pipeline.prepareRequestAdsSteps.push(mkPrepareRequestAdsStep('cmp-gpt-personalized-ads', LOW_PRIORITY, () => this.getTcData(log).then(tcData => {
      log.debug(this.name, 'gpt setting consent data', tcData, tcData.purpose);

      const purposeIdsConsented: number[] = Object.entries(tcData.purpose.consents)
        .filter(([ _, consent ]) => consent)
        .map(([ purposeId, _ ]) => parseInt(purposeId, 10));
      const hasNecessaryPurposeIds = this.googlePurposes.personalizedAds
        .every(purposeId => purposeIdsConsented.some(purposeIdWithConsent => purposeIdWithConsent === purposeId));
      this._window.googletag.pubads().setRequestNonPersonalizedAds(hasNecessaryPurposeIds ? 0 : 1);

      log.debug(this.name, `gpt setNonPersonalizedAds(${hasNecessaryPurposeIds ? '0' : '1'})`);

      if (!purposeIdsConsented.some(purposeIdWithConsent => purposeIdWithConsent === this.googlePurposes.nonPersonalizedAds)) {
        log.error(this.name, 'No consents for purpose 1. Ad delivery prohibited by Google');
      }

    })));
  }


  private getTcData = (log: Moli.MoliLogger): Promise<tcfapi.responses.TCData> => new Promise(resolve => {
    this.spWindow.__tcfapi('getTCData', 2, (tcData, success: boolean) => {
      log.debug(this.name, 'getTCData returned', success, tcData);
      resolve(tcData);
    });
  });


}
