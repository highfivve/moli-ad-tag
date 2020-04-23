import { AdPipelineContext, ConfigureStep } from './adPipeline';
import { Moli } from '../types/moli';

export const consentConfigureGpt = (cmp: Moli.consent.CmpModule): ConfigureStep => (context: AdPipelineContext) => {
  return cmp.getNonPersonalizedAdSetting().then(nonPersonalizedAds => {
    context.window.googletag.pubads().setTargeting('consent', nonPersonalizedAds === 0 ? 'full' : 'none');
    context.window.googletag.pubads().setRequestNonPersonalizedAds(nonPersonalizedAds);

    context.logger.debug('DFP Service', `googletag setRequestNonPersonalizedAds(${nonPersonalizedAds})`);
    if (nonPersonalizedAds) {
      context.logger.debug('DFP Service', 'Serve non-personalized ads');
    }
  });
};
