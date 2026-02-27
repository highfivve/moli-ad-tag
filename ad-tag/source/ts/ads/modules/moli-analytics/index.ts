import { IModule } from 'ad-tag/types/module';
import { modules } from 'ad-tag/types/moliConfig';
import { prebidjs } from 'ad-tag/types/prebidjs';
import { googletag } from 'ad-tag/types/googletag';
import { MoliRuntime } from 'ad-tag/types/moliRuntime';
import {
  AdPipelineContext,
  ConfigureStep,
  InitStep,
  mkInitStep,
  PrepareRequestAdsStep
} from 'ad-tag/ads/adPipeline';
import { uuidV4 } from 'ad-tag/util/uuid';
import { EventTracker, EventContext } from 'ad-tag/ads/modules/moli-analytics/types';
import { createSession } from 'ad-tag/ads/modules/moli-analytics/session';
import { createEventTracker } from 'ad-tag/ads/modules/moli-analytics/eventTracker';
import { eventMapper } from 'ad-tag/ads/modules/moli-analytics/events';
import { extractPubstackAbTestCohort } from '../pubstack/abTest';

const SESSION_TTL_MIN = 30;

export const DEFAULT_CONFIG = {
  batchSize: 4,
  batchDelay: 1000
};

export const MoliAnalytics = (): IModule => {
  let config: Required<modules.moliAnalytics.MoliAnalyticsConfig>;
  let eventContext: EventContext;
  let eventTracker: EventTracker;
  let adUnitsMap: Map<string, { auctionId: string; adUnitName: string; gpid: string }> = new Map();

  const generatePageViewId = (adPipelineContext: AdPipelineContext): string => 
    `pv-${uuidV4(adPipelineContext.window__)}`;

  const handleAuctionEnd = (
    event: prebidjs.event.AuctionObject,
    adPipelineContext: AdPipelineContext
  ) => {
    const auctionEnd = eventMapper.prebid.auctionEnd(event, eventContext, adPipelineContext);
    for (const adUnit of auctionEnd.data.adUnits) {
      adUnitsMap.set(adUnit.code, {
        auctionId: auctionEnd.data.auctionId,
        adUnitName: adUnit.adUnitName,
        gpid: adUnit.gpid
      });
    }
    eventTracker.track(auctionEnd);
  };

  const handleBidWon = (
    event: prebidjs.BidResponse,
    adPipelineContext: AdPipelineContext
  ) => {
    const adUnitData = adUnitsMap.get(event.adUnitCode);
    eventTracker.track(
      eventMapper.prebid.bidWon(
        event,
        {
          ...eventContext,
          gpid: adUnitData?.gpid || ''
        },
        adPipelineContext
      )
    );
  };

  const handleSlotRenderEnded = (
    event: googletag.events.ISlotRenderEndedEvent,
    adPipelineContext: AdPipelineContext
  ) => {
    const adUnitCode = event.slot.getSlotElementId();
    const adUnitData = adUnitsMap.get(adUnitCode);
    eventTracker.track(
      eventMapper.gpt.slotRenderEnded(
        event,
        {
          ...eventContext,
          auctionId: adUnitData?.auctionId || '',
          adUnitName: adUnitData?.adUnitName || adUnitCode,
          gpid: adUnitData?.gpid || ''
        },
        adPipelineContext
      )
    );
  };

  const handlePageView = (adPipelineContext: AdPipelineContext) => {
    // Set a new page view id on each page view
    eventContext.pageViewId = generatePageViewId(adPipelineContext);
    eventTracker.track(eventMapper.page.view(eventContext, adPipelineContext));
  };

  const configValid = (
    config: modules.moliAnalytics.MoliAnalyticsConfig,
    logger: MoliRuntime.MoliLogger
  ): boolean => {
    if (!config) {
      logger.error('moli-analytics: not configured');
      return false;
    }
    if (!config.publisher) {
      logger.error('moli-analytics: publisher is required');
      return false;
    }
    if (!config.url) {
      logger.error('moli-analytics: url is required');
      return false;
    }
    if (!config.batchSize || config.batchSize < 1) {
      logger.error('moli-analytics: batchSize must be greater than 0');
      return false;
    }
    if (!config.batchDelay || config.batchDelay < 1) {
      logger.error('moli-analytics: batchDelay must be greater than 0');
      return false;
    }
    return true;
  };

  const initMoliAnalytics = async (adPipelineContext: AdPipelineContext): Promise<void> => {
    if (!configValid(config, adPipelineContext.logger__)) {
      return Promise.reject('failed to initialize moli analytics: invalid configuration');
    }

    eventContext = {
      publisher: config.publisher,
      session: createSession(adPipelineContext.window__, SESSION_TTL_MIN),
      pageViewId: generatePageViewId(adPipelineContext),
      analyticsLabels: null
    };
    eventTracker = createEventTracker(
      config.url,
      config.batchSize,
      config.batchDelay,
      adPipelineContext.logger__
    );

    // Set analytics labels
    if (
      adPipelineContext.config__.configVersion?.identifier ||
      adPipelineContext.config__.configVersion?.versionVariant
    ) {
      eventContext.analyticsLabels = {
        ab_test: adPipelineContext.config__.configVersion?.identifier || null,
        variant: adPipelineContext.config__.configVersion?.versionVariant || null
      };
    }

    // Set up page view event
    if (adPipelineContext.config__.spa?.enabled) {
      // SPA - listen for page change
      adPipelineContext.window__.moli.addEventListener('afterRequestAds', event => {
        if (event.state === 'spa-finished' || event.state === 'finished') {
          handlePageView(adPipelineContext);
        }
      });
    }

    // Add prebid event listeners
    const setupPrebid = async () => {
      // Trigger the initial page view event after user ID resolved
      if (typeof adPipelineContext.window__.pbjs.getUserIdsAsync === 'function') {
        await adPipelineContext.window__.pbjs.getUserIdsAsync();
      }
      handlePageView(adPipelineContext);

      adPipelineContext.window__.pbjs.onEvent('auctionEnd', (event: prebidjs.event.AuctionObject) =>
        handleAuctionEnd(event, adPipelineContext)
      );
      adPipelineContext.window__.pbjs.onEvent('bidWon', (event: prebidjs.BidResponse) =>
        handleBidWon(event, adPipelineContext)
      );
    };
    if (typeof adPipelineContext.window__.pbjs.onEvent === 'function') {
      await setupPrebid();
    } else {
      adPipelineContext.window__.pbjs.que.push(setupPrebid);
    }

    // Add google publisher tag event listeners
    const setupGPT = () => {
      adPipelineContext.window__.googletag
        .pubads()
        .addEventListener('slotRenderEnded', (event: googletag.events.ISlotRenderEndedEvent) =>
          handleSlotRenderEnded(event, adPipelineContext)
        );
    };
    if (typeof adPipelineContext.window__.googletag.pubads === 'function') {
      setupGPT();
    } else {
      adPipelineContext.window__.googletag.cmd.push(setupGPT);
    }

    return Promise.resolve();
  };

  const setAnalyticsLabels = (ctx: AdPipelineContext): Promise<void> => {
    const pubstackAbTestCohort = extractPubstackAbTestCohort(ctx);
    const moliConfigVariant = ctx.config__.configVersion?.versionVariant;

    ctx.window__.pbjs.que.push(() =>
      ctx.window__.pbjs.mergeConfig({
        analyticsLabels: {
          pubstackAbCohort: pubstackAbTestCohort,
          configVariant: moliConfigVariant
        }
      })
    );
    return Promise.resolve();
  };

  return {
    name: 'moli-analytics',
    description: 'ad events tracking and analytics module',
    moduleType: 'reporting',
    config__(): modules.moliAnalytics.MoliAnalyticsConfig | null {
      return config;
    },
    configure__(moduleConfig?: modules.ModulesConfig): void {
      if (moduleConfig?.moliAnalytics?.enabled) {
        config = Object.assign({}, DEFAULT_CONFIG, moduleConfig.moliAnalytics);
      }
    },
    configureSteps__(): ConfigureStep[] {
      return [];
    },
    initSteps__(): InitStep[] {
      return [
        mkInitStep('moli-analytics-init', (context: AdPipelineContext) =>
          initMoliAnalytics(context)
        ),
        mkInitStep('set-analytics-labels', (context: AdPipelineContext) =>
          setAnalyticsLabels(context)
        )
      ];
    },
    prepareRequestAdsSteps__(): PrepareRequestAdsStep[] {
      return [];
    }
  };
};
