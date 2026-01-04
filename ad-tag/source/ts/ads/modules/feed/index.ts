import { modules } from 'ad-tag/types/moliConfig';
import { IModule } from 'ad-tag/types/module';
import {
  AdPipelineContext,
  ConfigureStep,
  InitStep,
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
      const config = feedConfig;
      return config ? [mkInitStep('feed-init', ctx => loadFeed(config, ctx))] : [];
    },
    configureSteps__(): ConfigureStep[] {
      return [];
    },
    prepareRequestAdsSteps__(): PrepareRequestAdsStep[] {
      return [];
    }
  };
};
