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
import { AnalyticsSession, EventTracker, Events } from 'ad-tag/ads/modules/moli-analytics/types';
import { createSession } from 'ad-tag/ads/modules/moli-analytics/session';
import { createEventTracker } from 'ad-tag/ads/modules/moli-analytics/eventTracker';
import { eventMapper } from 'ad-tag/ads/modules/moli-analytics/events';

const SESSION_TTL_MIN = 30;

export const DEFAULT_CONFIG = {
  batchSize: 4,
  batchDelay: 1000
};

export const MoliAnalytics = (): IModule => {
  let config: Required<modules.moliAnalytics.MoliAnalyticsConfig>;
  let context: AdPipelineContext;
  let session: AnalyticsSession;
  let eventTracker: EventTracker;
  let analyticsLabels: Events.AnalyticsLabels = null;
  let pageViewId: string;

  const handleAuctionEnd = (auction: prebidjs.event.AuctionObject) => {
    eventTracker.track(
      eventMapper.prebid.auctionEnd(auction, context, config.publisher, analyticsLabels)
    );
  };

  const handleBidWon = (response: prebidjs.BidResponse) => {
    eventTracker.track(eventMapper.prebid.bidWon(response, config.publisher, analyticsLabels));
  };

  const handleSlotRenderEnded = (event: googletag.events.ISlotRenderEndedEvent) => {
    eventTracker.track(
      eventMapper.gpt.slotRenderEnded(
        event,
        context,
        config.publisher,
        session.getId(),
        pageViewId,
        analyticsLabels
      )
    );
  };

  const handlePageView = () => {
    pageViewId = `pv-${uuidV4(context.window__)}`;
    eventTracker.track(
      eventMapper.page.view(context, config.publisher, session.getId(), pageViewId, analyticsLabels)
    );
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

  const initMoliAnalytics = (adPipelineContext: AdPipelineContext): Promise<void> => {
    if (!configValid(config, adPipelineContext.logger__)) {
      return Promise.reject('failed to initialize moli analytics: invalid configuration');
    }

    context = adPipelineContext;
    session = createSession(context.window__, SESSION_TTL_MIN);
    eventTracker = createEventTracker(
      config.url,
      config.batchSize,
      config.batchDelay,
      context.logger__
    );

    // Set analytics labels
    if (
      context.config__.configVersion?.identifier ||
      context.config__.configVersion?.versionVariant
    ) {
      analyticsLabels = {
        ab_test: context.config__.configVersion?.identifier || null,
        variant: context.config__.configVersion?.versionVariant || null
      };
    }

    // Setup page view event
    if (context.config__.spa?.enabled) {
      // SPA - listen for page change
      context.window__.moli.addEventListener('afterRequestAds', event => {
        if (event.state === 'spa-finished') {
          handlePageView();
        }
      });
    } else {
      // non-SPA - trigger page view once
      handlePageView();
    }

    // Add prebid event listeners
    const setupPrebid = () => {
      context.window__.pbjs.onEvent('auctionEnd', handleAuctionEnd);
      context.window__.pbjs.onEvent('bidWon', handleBidWon);
    };
    if (typeof context.window__.pbjs.onEvent === 'function') {
      setupPrebid();
    } else {
      context.window__.pbjs.que.push(setupPrebid);
    }

    // Add google publisher tag event listeners
    const setupGPT = () => {
      context.window__.googletag
        .pubads()
        .addEventListener('slotRenderEnded', handleSlotRenderEnded);
    };
    if (typeof context.window__.googletag.pubads === 'function') {
      setupGPT();
    } else {
      context.window__.googletag.cmd.push(setupGPT);
    }

    return Promise.resolve();
  };

  const extractPubstackAbTestCohort = (ctx: AdPipelineContext): string | null => {
    // these map to key-value values in GAM. Other values are not configured there and don't need to be sent along
    const pubstackABTestValues = ['0', '1', '2', '3'];
    if (ctx.env__ === 'test') {
      return null;
    }
    // find meta data
    const meta = ctx.window__.document.head.querySelector<HTMLMetaElement>(
      'meta[name="pbstck_context:pbstck_ab_test"]'
    );
    if (meta && meta.content && pubstackABTestValues.includes(meta.content)) {
      return meta.content;
    }
    return null;
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
