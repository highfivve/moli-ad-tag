import { AdPipelineContext, ConfigureStep, mkConfigureStep } from './adPipeline';
import { Moli } from '../types/moli';

export const consentConfigureGpt = (cmp: Moli.consent.CmpModule): ConfigureStep => mkConfigureStep('gpt-personalized-ads', (context: AdPipelineContext) => {
  return cmp.getNonPersonalizedAdSetting().then(nonPersonalizedAds => {
    context.window.googletag.pubads().setTargeting('consent', nonPersonalizedAds === 0 ? 'full' : 'none');
    context.window.googletag.pubads().setRequestNonPersonalizedAds(nonPersonalizedAds);

    context.logger.debug('GAM', `googletag setRequestNonPersonalizedAds(${nonPersonalizedAds})`);
    if (nonPersonalizedAds) {
      context.logger.debug('GAM', 'Serve non-personalized ads');
    }
  });
});
