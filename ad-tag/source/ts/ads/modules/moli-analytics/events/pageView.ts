import type { AdPipelineContext } from 'ad-tag/ads/adPipeline';
import type { Events } from 'ad-tag/ads/modules/moli-analytics/types';

const parseUTM = (search: string): Events.UTMParams => {
  const params = new URLSearchParams(search);
  const v = (k: string) => params.get(k) || null;

  return {
    source: v('utm_source'),
    medium: v('utm_medium'),
    campaign: v('utm_campaign'),
    content: v('utm_content'),
    term: v('utm_term')
  };
};

export const mapPageView = (
  context: AdPipelineContext,
  publisher: string,
  sessionId: string,
  pageViewId: string,
  analyticsLabels: Events.AnalyticsLabels
): Events.Page.View => {
  const timestamp = Date.now();
  return {
    v: 1,
    type: 'page.view',
    publisher,
    timestamp,
    payload: {
      timestamp: new Date(timestamp).toISOString(),
      data: {
        analyticsLabels,
        sessionId,
        pageViewId,
        domain: context.window__.location.hostname,
        ua: context.window__.navigator.userAgent,
        utm: parseUTM(context.window__.location.search)
      }
    }
  };
};
