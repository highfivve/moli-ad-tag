import { modules } from 'ad-tag/types/moliConfig';
import { IModule } from 'ad-tag/types/module';
import { ConfigureStep, InitStep, mkInitStep, PrepareRequestAdsStep } from 'ad-tag/ads/adPipeline';

const getBaseUrl = (): string => {
  const url = new URL(window.location.href);
  return url.origin + url.pathname;
};

// Fetch content from the API
const fetchContent = async (contentFeedUrl: URL) => {
  try {
    const baseUrl = getBaseUrl();
    contentFeedUrl.searchParams.set('url', encodeURIComponent(baseUrl));
    const response = await fetch(contentFeedUrl.toString(), {
      headers: {
        Accept: 'text/html'
      }
    });

    if (!response.ok) {
      console.error('feed', `HTTP error! status: ${response.status}`);
      return null;
    }

    return await response.text();
  } catch (error) {
    console.error('feed', 'Error fetching content:', error);
    return null;
  }
};

/**
 * @see https://stackoverflow.com/questions/2592092/executing-script-elements-inserted-with-innerhtml
 */
const reinsertScripts = (container: Element): void => {
  Array.from(container.querySelectorAll('script')).forEach(oldScriptEl => {
    const newScriptEl = document.createElement('script');

    Array.from(oldScriptEl.attributes).forEach(attr => {
      newScriptEl.setAttribute(attr.name, attr.value);
    });

    const scriptText = document.createTextNode(oldScriptEl.innerHTML);
    newScriptEl.appendChild(scriptText);

    if (oldScriptEl.parentNode) {
      oldScriptEl.parentNode.replaceChild(newScriptEl, oldScriptEl);
    } else {
      console.warn(
        'feed',
        'Script element has no parent node, cannot reinsert script:',
        oldScriptEl
      );
    }
  });
};

const loadFeed = async (config: modules.feed.FeedConfig): Promise<void> => {
  for (const options of config.feeds) {
    for (const element of document.querySelectorAll(options.selector)) {
      const feedUrl = new URL(`https://feed.h5v.eu/api/content/feed/${options.feedId}`);
      if (options.keywords) {
        feedUrl.searchParams.set('keywords', encodeURIComponent(options.keywords.join(';')));
      }
      const html = await fetchContent(feedUrl);
      if (html) {
        // If not using shadow DOM, just set the innerHTML directly
        element.innerHTML = html;
        reinsertScripts(element);
      } else {
        console.warn('feed', 'No content received from API');
      }
    }
  }
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
      return config ? [mkInitStep('feed-init', () => loadFeed(config))] : [];
    },
    configureSteps__(): ConfigureStep[] {
      return [];
    },
    prepareRequestAdsSteps__(): PrepareRequestAdsStep[] {
      return [];
    }
  };
};
