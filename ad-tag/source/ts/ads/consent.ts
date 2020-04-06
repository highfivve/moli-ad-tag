import { ConfigureStep } from './adPipeline';
import { Moli } from '../types/moli';

export const consentConfigureGpt = (window: Window, cmp: Moli.consent.CmpModule, logger: Moli.MoliLogger): ConfigureStep => () => {
  return cmp.getNonPersonalizedAdSetting().then(nonPersonalizedAds => {
    window.googletag.pubads().setTargeting('consent', nonPersonalizedAds === 0 ? 'full' : 'none');
    window.googletag.pubads().setRequestNonPersonalizedAds(nonPersonalizedAds);

    logger.debug('DFP Service', `googletag setRequestNonPersonalizedAds(${nonPersonalizedAds})`);
    if (nonPersonalizedAds) {
      logger.debug('DFP Service', 'Serve non-personalized ads');
    }
  });
};
