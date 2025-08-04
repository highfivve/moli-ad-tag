import { Moli } from '../types/moli';

const getBaseUrl = (window: Window): string => {
  const url = new URL(window.location.href);
  return url.origin + url.pathname;
};

// Fetch content from the API
const fetchContent = async (contentFeedUrl: URL, window: Window, logger: Moli.MoliLogger) => {
  try {
    const baseUrl = getBaseUrl(window);
    contentFeedUrl.searchParams.set('url', encodeURIComponent(baseUrl));
    const response = await fetch(contentFeedUrl.toString(), {
      headers: {
        Accept: 'text/html'
      }
    });

    if (!response.ok) {
      logger.error('feed', `HTTP error! status: ${response.status}`);
      return null;
    }

    return await response.text();
  } catch (error) {
    logger.error('feed', 'Error fetching content:', error);
    return null;
  }
};

// Create and mount shadow DOM
const mountShadowDOM = (container: Element, html: string) => {
  // Create shadow root
  const shadow = container.attachShadow({ mode: 'open' });

  // Create a wrapper div for the content
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;

  // Add the content to shadow DOM
  shadow.appendChild(wrapper);
};

export const loadFeed = async (
  options: Moli.FeedOptions,
  _window: Window,
  logger: Moli.MoliLogger
): Promise<void> => {
  for (const element of _window.document.querySelectorAll(options.selector)) {
    const feedUrl = new URL(`https://feed.h5v.eu/feed/${options.feedId}`);
    if (options.keywords) {
      feedUrl.searchParams.set('keywords', encodeURIComponent(options.keywords.join(';')));
    }
    const html = await fetchContent(feedUrl, _window, logger);
    if (html) {
      mountShadowDOM(element, html);
    } else {
      logger.warn('feed', 'No content received from API');
    }
  }
};
