/**
 * # Feed Module
 *
 * The feed module allows you to load arbitrary HTML content into a specific container on your page. Primary use cases include "smart feeds" or recommendation widgets, but it can be used for any dynamic content injection.
 *
 * ## Use Cases
 * - Displaying personalized or contextual recommendation widgets.
 * - Integrating third-party content feeds (e.g., news, products, social widgets).
 * - Loading custom HTML into containers based on page context or user segments.
 *
 * Custom keywords can be attached to each feed option for more granular targeting.
 *
 * ## Configuration and Integration
 *
 * To enable the feed module, add a `feed` section to your modules config:
 *
 * ```json
 * {
 *   "feed": {
 *     "enabled": true,
 *     "feeds": [
 *       {
 *         "selector": ".feed-container",
 *         "feedUrl": "https://api.example.com/feed",
 *         "keywords": ["sports", "news"],
 *         "labels": ["desktop", "homepage"]
 *       }
 *     ]
 *   }
 * }
 * ```
 *
 * - `selector`: CSS selector for the container(s) to inject content into.
 * - `feedUrl`: The endpoint returning HTML to inject.
 * - `keywords`: (Optional) Array of keywords sent to the feed API for targeting.
 * - `labels`: (Optional) Conditional labels to control when the feed is active.
 *
 * Feeds are only injected if their labels match the current context, making it easy to enable or disable feeds dynamically.
 *
 * ## How it Works
 * - On initialization, the module fetches content for each configured feed and injects it into the matching container(s).
 * - Any `<script>` tags in the injected HTML are re-executed for full widget compatibility.
 * - Label-based filtering ensures feeds are only active in the right context.
 *
 * For more on label configuration, see the documentation for the label system.
 *
 * @module
 */
import { modules } from 'ad-tag/types/moliConfig';
import { IModule } from 'ad-tag/types/module';
import {
  AdPipelineContext,
  ConfigureStep,
  InitStep,
  mkConfigureStepOncePerRequestAdsCycle,
  mkInitStep,
  PrepareRequestAdsStep
} from 'ad-tag/ads/adPipeline';

const getBaseUrl = (ctx: AdPipelineContext): string => {
  const url = new URL(ctx.window__.location.href);
  return url.origin + url.pathname;
};

// Fetch content from the API
const fetchContent = async (contentFeedUrl: URL, ctx: AdPipelineContext) => {
  try {
    const baseUrl = getBaseUrl(ctx);
    contentFeedUrl.searchParams.set('url', encodeURIComponent(baseUrl));
    const response = await ctx.window__.fetch(contentFeedUrl.toString(), {
      headers: {
        Accept: 'text/html'
      }
    });

    if (!response.ok) {
      ctx.logger__.error('feed', `HTTP error! status: ${response.status}`);
      return null;
    }

    return await response.text();
  } catch (error) {
    ctx.logger__.error('feed', 'Error fetching content:', error);
    return null;
  }
};

/**
 * @see https://stackoverflow.com/questions/2592092/executing-script-elements-inserted-with-innerhtml
 */
const reinsertScripts = (container: Element, ctx: AdPipelineContext): void => {
  Array.from(container.querySelectorAll('script')).forEach(oldScriptEl => {
    const newScriptEl = ctx.window__.document.createElement('script');

    Array.from(oldScriptEl.attributes).forEach(attr => {
      newScriptEl.setAttribute(attr.name, attr.value);
    });

    const scriptText = ctx.window__.document.createTextNode(oldScriptEl.innerHTML);
    newScriptEl.appendChild(scriptText);

    if (oldScriptEl.parentNode) {
      oldScriptEl.parentNode.replaceChild(newScriptEl, oldScriptEl);
    } else {
      ctx.logger__.warn(
        'feed',
        'Script element has no parent node, cannot reinsert script:',
        oldScriptEl
      );
    }
  });
};

const loadFeed = (config: modules.feed.FeedConfig, ctx: AdPipelineContext): Promise<void> => {
  config.feeds
    .filter(options => ctx.labelConfigService__.filterSlot(options))
    .forEach(options => {
      ctx.window__.document.querySelectorAll(options.selector).forEach(element => {
        const feedUrl = new URL(options.feedUrl);
        if (options.keywords) {
          feedUrl.searchParams.set('keywords', encodeURIComponent(options.keywords.join(';')));
        }
        fetchContent(feedUrl, ctx).then(html => {
          if (html) {
            element.innerHTML = html;
            reinsertScripts(element, ctx);
          } else {
            ctx.logger__.warn('feed', 'No content received from API');
          }
        });
      });
    });
  return Promise.resolve();
};

export const feedModule = (): IModule => {
  let feedConfig: modules.feed.FeedConfig | null = null;
  return {
    name: 'feed',
    description: 'community feed',
    moduleType: 'creatives',
    config__(): Object | null {
      return feedConfig;
    },
    configure__(moduleConfig?: modules.ModulesConfig) {
      if (moduleConfig?.feed && moduleConfig.feed.enabled) {
        feedConfig = moduleConfig.feed;
      }
    },
    initSteps__(): InitStep[] {
      return [];
    },
    configureSteps__(): ConfigureStep[] {
      const config = feedConfig;
      return config
        ? [mkConfigureStepOncePerRequestAdsCycle('feed-loading', ctx => loadFeed(config, ctx))]
        : [];
    },
    prepareRequestAdsSteps__(): PrepareRequestAdsStep[] {
      return [];
    }
  };
};
