import {IPerformanceMeasurementService, performanceMeasurementService} from '../../performanceService';
import {ITrackService, trackService} from '../../../tracker';
import {DfpPrebidSlot, DfpSlot} from './adNetworkSlot';
import {googletag} from '../../../types/googletag';
import {prebidjs} from '../../../types/prebidjs';
import {ILogger, globalLogger} from '../../../utils/logger';
import {gfUserAgent} from '../../../context/UserAgent';
import {gfContext} from '../../../context/GfContext';

/**
 *
 */
type IPerformanceUBEvent = {

  /**
   * identifies all tracking requests that came from the same page view.
   */
  readonly prId: string;

  /**
   * The adunit path we are tracking
   */
  readonly adu: string;

  /**
   * The advertiserId identifies the company that won the ad request.
   *
   * https://admanager.google.com/33559401#admin/companyDetail/id=<advertiserId>
   */
  readonly aid?: number;

  /**
   * The campaignId (or orderId) identifies the order that won the ad request.
   *
   * https://admanager.google.com/33559401#delivery/OrderDetail/orderId=<campaignId>
   */
  readonly caid?: number;

  /**
   * The lineItemId identifies the lineItem that won the ad request.
   *
   * You can go to the respective line item with:
   * https://admanager.google.com/33559401#delivery/LineItemDetail/orderId=<campaignId>&lineItemId=<lineItemId>
   */
  readonly lid?: number;

  /**
   * Contains the timing information measured via the performance API
   */
  t: {
    /**
     * CMP load started at (in ms)
     */
    cmpS: number;

    /**
     * CMP load duration in ms
     */
    cmpD: number;

    /**
     * DFP load started at (in ms)
     */
    dfpS: number;

    /**
     * DFP ad slot rendered at (in ms)
     */
    dfpR: number;

    /**
     * DFP ad slot content loaded at (in ms)
     */
    dfpL: number;

    /**
     * Prebid request started at (in ms)
     */
    preR?: number;

    /**
     * Prebid duration in ms
     */
    preD?: number;
  }
};

/**
 * == Ad Performance Service ==
 *
 * Defines and controls all ad related performance tracking.
 *
 * The data is rate limited and collected via our UB tracking and processed by a bunch of kafka stream
 * processors that feed dashboards to monitor our latencies at various levels (position, advertiser, etc.).
 *
 * All events that we track will have `pageRequestId`, which groups all events that were sent by the same
 * client. This allows deeper analysis on ads that cause high latencies.
 *
 * == Marks & Measurements ==
 *
 * This sections contains an overview of the various markers that are being used.
 *
 * === CMP - Consent Management Platform ===
 *
 * Measurement : cmp_load_time
 * start mark  : cmp_load_start
 * end mark    : cmp_load_end
 *
 * === Ad slots ===
 *
 * Measurement : dfp_load_time
 * start mark  : dfp_load_start
 * end mark    : dfp_load_end
 *
 * The total time it took to load, initialize and render all ads via dfp
 *
 * -----------------------
 *
 * Measurement : dfp_first_ad_load_time
 * Measurement : dfp_first_ad_load_time_mobile
 * Measurement : dfp_first_ad_load_time_desktop
 * start mark  : dfp_load_start
 * end mark    : dfp_first_ad_load_stop
 *
 * The total time it took to load the fastest ad on the page.
 *
 * -----------------------
 *
 * Measurement : <adunit_path>_content_loaded_total
 * start mark  : <adunit_path>_dfp_load_start
 * end mark    : <adunit_path>_content_loaded
 *
 * The total time it took to render the ad slot with <adunit_path>.
 *
 * -----------------------
 *
 * Measurement : <adunit_path>_render_content_loaded
 * start mark  : <adunit_path>_rendered
 * end mark    : <adunit_path>_content_loaded
 *
 * The total time it took to load the ad after being rendered by DFP.
 *
 * -----------------------
 *
 * === Prebid ===
 *
 * Measurement : <adunit_path>_prebid_response_time
 * start mark  : prebid_requested
 * end mark    : prebid_bids_back
 *
 * The total time for each ad unit that got a bid response.
 *
 *
 */
export interface IAdPerformanceService {

  /**
   * This should be set by an external ad block detection. At the moment this is the happy unicorns service.
   * We don't want to track ad-block traffic as this skews results and is not interesting for our performance
   * and latency measurements
   */
  setAdBlockerDetected(): void;

  /**
   * Call when the DFP services starts working
   */
  markDfpInitialization(): void;

  /**
   * Called when `dfpSlot.defineSlotOnGoogleTag()` is invoked.
   *
   * @param dfpSlot the dfp slot that is being registered
   */
  markRegisterSlot(dfpSlot: DfpSlot): void;

  /**
   * Called before `pbjs.requestBids()` is invoked.
   */
  markPrebidSlotsRequested(): void;


  /**
   *
   * @param prebidSlots
   * @param bids
   */
  measurePrebidSlots(prebidSlots: DfpPrebidSlot[], bids: prebidjs.IBidResponsesMap): void;

  /**
   * Creates a promise that resolves after the fastest ad content has been loaded.
   * This is used to turn off the skeleton loading if the fastest ad comes before
   * our hard coded time out.
   *
   * @param googleTag
   * @param adSlots all requested ad slots
   * @return a promise that resolves when the content of the fastest ad slot has been loaded
   */
  measureFirstAdLoadTime(googleTag: googletag.IGoogleTag, adSlots: DfpSlot[]): Promise<void>;

  /**
   * Measures load time for all ad slots
   *
   * @param googleTag
   * @param adSlots
   */
  measureAdSlots(googleTag: googletag.IGoogleTag, adSlots: DfpSlot[]): void;

  /**
   * Mark when the CMP solution is being initialized
   */
  markCmpInitialization(): void;

  /**
   * Measure how long our CMP solution took to setup
   */
  measureCmpLoadTime(): void;
}

class AdPerformanceService implements IAdPerformanceService {

  /**
   * unique identifier to associate requests made from a single page view in our tracking data.
   */
  private readonly pageRequestId: string;

  private readonly fixedSamplingRate = 0.05;

  /**
   * True if the page requests should be used as a performance measurement sample.
   *
   * WARNING: the `performanceService` has it's own sample rate, when using `measureAndSend`!
   */
  private readonly isSample: boolean;

  /**
   * Stores if an external ad blocker was detected
   */
  private adBlockDetected: boolean = false;

  constructor(
      private readonly performanceService: IPerformanceMeasurementService,
      private readonly trackService: ITrackService,
      private readonly logger: ILogger
  ) {
      try {
        this.pageRequestId = this.uuidv4();
        const samplingRate = gfContext.samplingRate() || this.fixedSamplingRate;
        this.isSample = Math.random() <= samplingRate;
        logger.debug(`[AdPerformanceService] isSample ${this.isSample} (${samplingRate}) | pageRequestId ${this.pageRequestId}`);
      } catch (e) {
        // fallback if anything goes wrong
        this.pageRequestId = '00000000-0000-0000-0000-000000000000';
        this.isSample = false;
        this.logger.error('[AdPerformanceService] Initializing failed', e);
      }
  }

  public setAdBlockerDetected(): void {
    this.adBlockDetected = true;
  }

  public markCmpInitialization(): void {
    this.performanceService.mark('cmp_load_start');
  }

  public measureCmpLoadTime(): void {
    this.performanceService.mark('cmp_load_end');
    this.performanceService.measure('cmp_load_time', 'cmp_load_start', 'cmp_load_end');
  }


  public markDfpInitialization(): void {
    this.performanceService.mark('dfp_load_start');
  }

  public markRegisterSlot(dfpSlot: DfpSlot): void {
    this.performanceService.mark(`${this.minimalAdUnitName(dfpSlot.adUnitPath)}_register`);
  }

  public measureFirstAdLoadTime(googleTag: googletag.IGoogleTag): Promise<void> {
    return new Promise<void>(resolve => {
      let isResolved = false;
      googleTag.pubads().addEventListener('slotOnload', () => {
        if (!isResolved) {
          resolve();
          isResolved = true;
        }
      });
    }).then(() => {
      this.performanceService.mark('dfp_first_ad_load_stop');
      if (gfUserAgent.isMobile()) {
        this.performanceService.measureAndSend('dfp_first_ad_load_time_mobile', 'dfp_load_start', 'dfp_first_ad_load_stop');
      } else {
        this.performanceService.measureAndSend('dfp_first_ad_load_time_desktop', 'dfp_load_start', 'dfp_first_ad_load_stop');
      }
      this.performanceService.measure('dfp_first_ad_load_time', 'dfp_load_start', 'dfp_first_ad_load_stop');
    });
  }

  public measureAdSlots(googleTag: googletag.IGoogleTag, adSlots: DfpSlot[]): void {
    this.awaitAllAdSlotsRendered(googleTag, adSlots)
      .then(renderedEvents => this.trackAverageAdSlots(renderedEvents))
      .then(renderedEvents => this.trackNoGoogleAds(renderedEvents))
      .then((resolvedEvents: googletag.events.ISlotRenderEndedEvent[]) => Promise.all(
        resolvedEvents.map(event => this.awaitAdSlotContentLoaded(googleTag, event).then(() => this.measureAdSlotContentLoaded(event))
      )))
      .then(() => this.performanceService.measure('dfp_load_time', 'dfp_load_start'));
  }


  public markPrebidSlotsRequested(): void {
    this.performanceService.mark('prebid_requested');
  }

  public measurePrebidSlots(prebidSlots: DfpPrebidSlot[], bids: prebidjs.IBidResponsesMap): void {
    this.performanceService.mark('prebid_bids_back');
    prebidSlots.forEach(slot => {
      // measure only for bidders that actually returned something
      const bid = bids[slot.id];
      if (bid) {
        const adUnitName = this.minimalAdUnitName(slot.adUnitPath);
        this.performanceService.measure(`${adUnitName}_prebid_response_time`, 'prebid_requested', 'prebid_bids_back');
      }
    });
  }

  /**
   * If this page request should be measured and tracked
   */
  private shouldTrack(): boolean {
    return this.isSample && !this.adBlockDetected;
  }

  /**
   * Returns a promise which resolves when all ad slots have been rendered.
   *
   * @return {Promise<googletag.events.ISlotRenderEndedEvent[]>}
   */
  private awaitAllAdSlotsRendered(googleTag: googletag.IGoogleTag, adSlots: DfpSlot[]): Promise<googletag.events.ISlotRenderEndedEvent[]> {
    const renderedAdSlots = adSlots.map((slot) => {
      return new Promise<googletag.events.ISlotRenderEndedEvent>(resolve => {
        googleTag.pubads().addEventListener('slotRenderEnded', event => {
          if (event.slot.getAdUnitPath() === slot.adUnitPath) {
            this.performanceService.mark(`${this.minimalAdUnitName(event.slot.getAdUnitPath())}_rendered`);
            resolve(event);
          }
        });
      });
    });


    return Promise.all(renderedAdSlots);
  }

  private awaitAdSlotContentLoaded(googleTag: googletag.IGoogleTag, event: googletag.events.ISlotRenderEndedEvent): Promise<googletag.events.ISlotRenderEndedEvent> {
    // no ad on this slot this time. sad panda.
    if (event.isEmpty || !event.slot) {
      return Promise.resolve(event);
    }

    return new Promise<googletag.events.ISlotRenderEndedEvent>(resolve => {
      googleTag.pubads().addEventListener('slotOnload', (onLoadEvent) => {
        if (onLoadEvent.slot.getAdUnitPath() === event.slot.getAdUnitPath()) {
          resolve(event);
        }
      });
    });
  }

  /**
   * Creates measurements for a given ad slot.
   * Must be called after awaitAdSlotContentLoaded.
   *
   * @param event
   */
  private measureAdSlotContentLoaded(event: googletag.events.ISlotRenderEndedEvent): void {
    const adUnitName = this.minimalAdUnitName(event.slot.getAdUnitPath());
    this.performanceService.mark(`${adUnitName}_content_loaded`);
    this.performanceService.measure(
      `${adUnitName}_content_loaded_total`,
      `dfp_load_start`,
      `${adUnitName}_content_loaded`);
    this.performanceService.measure(
      `${adUnitName}_render_content_loaded`,
      `${adUnitName}_rendered`,
      `${adUnitName}_content_loaded`);

    // create a ub tracking event
    if (this.shouldTrack()) {
      const cmpLoadTime = this.performanceService.getMeasure('cmp_load_time');
      const contentLoadTotalMeasure = this.performanceService.getMeasure(`${adUnitName}_content_loaded_total`);
      const renderContentLoaded = this.performanceService.getMeasure(`${adUnitName}_render_content_loaded`);
      const prebid = this.performanceService.getMeasure(`${adUnitName}_prebid_response_time`);

      // bail out if any of the requested values cannot be accessed
      if (!contentLoadTotalMeasure || !renderContentLoaded || !cmpLoadTime) {
        return;
      }

      const trackingEvent: IPerformanceUBEvent = {
        prId: this.pageRequestId,
        adu: adUnitName,
        aid: event.advertiserId,
        caid: event.campaignId,
        lid: event.lineItemId || event.sourceAgnosticLineItemId,
        t: {
          cmpS: Math.round(cmpLoadTime.startTime),
          cmpD: Math.round(cmpLoadTime.duration),
          dfpS: Math.round(contentLoadTotalMeasure.startTime),
          dfpR: Math.round(renderContentLoaded.startTime),
          dfpL: Math.round(contentLoadTotalMeasure.startTime + contentLoadTotalMeasure.duration),
        }
      };

      if (prebid) {
        trackingEvent.t.preR = Math.round(prebid.startTime);
        trackingEvent.t.preD = Math.round(prebid.duration);
      }

      this.trackService.trackEvent(['ub'], 'ads', 'slot_perf', JSON.stringify(trackingEvent));
    }
  }



  /**
   * Used for performance logging to create more readable names
   * @param adUnit the full adUnit path
   * @return stripped adunit path with only the relevant stuff
   */
  private minimalAdUnitName(adUnit: string): string {
    return adUnit.replace('/33559401/gf/', '');
  }

  private trackAverageAdSlots(renderedEvents: googletag.events.ISlotRenderEndedEvent[]): googletag.events.ISlotRenderEndedEvent[] {
    if (!this.shouldTrack()) {
      return renderedEvents;
    }

    // track the amount of ad slots that were successfully requested and rendered. We use this to monitor our
    // ad setup for major delivery issues.
    this.trackService.trackEvent(['ub'], 'qdp_ads', 'ad_slots_rendered', renderedEvents.length.toString(), '', true);
    this.trackService.trackEvent(['ub'], 'qdp_ads', 'ad_slots_empty', renderedEvents.filter(slot => slot.isEmpty).length.toString(), '', true);

    // previous qdp_ads tracking - if at least one slot was empty we track it
    const nonEmptySlots = renderedEvents.filter(slot => !slot.isEmpty).length;
    if (nonEmptySlots === 0) {
      // track pages where we haven't displayed ANY advertising via dfp
      this.trackService.trackEvent([ 'ga' ], 'qdp_ads', 'no_ads', 'true', '', true);
    }
    return renderedEvents;
  }


  /**
   * Report `no_google_ads` means that google detected adult content on our website.
   *
   * We use this information to filter out recommended questions, because
   * we don't want users to see possible illegal or not-appropriate content.
   *
   * NOTE: no google ads doesn't mean there aren't any ads. We still have other ways for advertister to place their ads:
   *       - special video campaigns and creatives
   *       - header bidding via prebid
   *       - header bidding via amazon
   *       - backfill campaigns like plista
   *
   */
  private trackNoGoogleAds(renderedEvents: googletag.events.ISlotRenderEndedEvent[]): googletag.events.ISlotRenderEndedEvent[] {
    if (!this.shouldTrack()) {
      return renderedEvents;
    }
    const relatedContentSlots = renderedEvents.filter(
      slot => slot.slot.getAdUnitPath().match(/.*RelatedContentStream[1-3]?$/)
    );
    if (relatedContentSlots.length > 0) {

      // AdSense campaigns. AdSense will loose more and more relevancy while we transition to AdX
      const adsenseLineItemIds = [
        4662699582, // Sales_Yield_Google_Adsense_D_RelatedContentStream1,2,3
        94220201 // Sales_Yield_Google_Adsense_M_Video_ohne_WLAN
      ];

      // AdX campaigns.
      const adxLineItemIds = [
        4662564863, // Sales_Yield_Google_AdX_D_RelatedContent
        4662599033 // Sales_Yield_Google_AdX_M_RelatedContentStream 1,2,3
      ];

      const filteredLineItems = [...adsenseLineItemIds, ...adxLineItemIds];
      const googleSlots = relatedContentSlots.filter(
        slot => filteredLineItems.some(
          // We mark an AdSlot as a google adSlot when the lineItemId matches one of our LineItems (campaigns) in DFP.
          // The `sourceAgnosticLineItemId` is used when a backfill campaign is delivered via the AdSense or AdX
          // network.
          lineItemId => slot.lineItemId === lineItemId || slot.sourceAgnosticLineItemId === lineItemId
        )
      );
      if (googleSlots.length === 0) {
        this.trackService.trackEvent([ 'ub' ], 'qdp_ads', 'no_google_ads', 'true', '', true);
      }
    }
    return renderedEvents;
  }
  /**
   * minimalistic uuid generation.
   * @see https://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
   */
  private uuidv4(): string {
    /* tslint:disable */
    if ('crypto' in window && 'getRandomValues' in window.crypto) {
      return ( ([1e7] as any)+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, (c: any) =>
        (c ^ window.crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
      )
    } else {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }
    /* tslint:enabled */
  }

}

export const adPerformanceService: IAdPerformanceService = new AdPerformanceService(performanceMeasurementService, trackService, globalLogger);
