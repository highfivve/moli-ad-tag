import type { AdPipelineContext } from 'ad-tag/ads/adPipeline';
import type { EventContext, Events } from 'ad-tag/ads/modules/moli-analytics/types';

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
  context: EventContext,
  adContext: AdPipelineContext
): Events.Page.View => {
  const timestamp = Date.now();
  const userIds = adContext.window__.pbjs.getUserIds ? adContext.window__.pbjs.getUserIds() : {};
  return {
    v: 1,
    type: 'page.view',
    publisher: context.publisher,
    pageViewId: context.pageViewId,
    userId: userIds?.pubcid,
    timestamp,
    analyticsLabels: context.analyticsLabels,
    data: {
      sessionId: context.session.getId(),
      device: adContext.labelConfigService__.getDeviceLabel(),
      domain: adContext.window__.moli.resolveAdUnitPath('{domain}'),
      ua: adContext.window__.navigator.userAgent,
      utm: parseUTM(adContext.window__.location.search)
    }
  };
};
