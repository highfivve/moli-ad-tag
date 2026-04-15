import { EventContext } from 'ad-tag/ads/modules/moli-analytics/types';

export const createEventContextStub = (): EventContext => ({
  publisher: 'pub-001',
  pageViewId: 'pv-001',
  session: {
    getId: () => 'sess-001'
  },
  analyticsLabels: {
    variant: 'a',
    ab_test: 'a_1'
  }
});
