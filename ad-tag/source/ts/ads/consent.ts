import { AdPipelineContext, ConfigureStep, mkConfigureStep } from './adPipeline';
import { Moli } from '../types/moli';
import {ReportingService} from './reportingService';

export const consentConfigureGpt = (cmp: Moli.consent.CmpModule, reportingService: ReportingService): ConfigureStep => mkConfigureStep('gpt-personalized-ads', (context: AdPipelineContext) => {
  reportingService.markCmpInitialization();

  return cmp.getNonPersonalizedAdSetting().then(nonPersonalizedAds => {
    reportingService.measureCmpLoadTime();

    context.window.googletag.pubads().setTargeting('consent', nonPersonalizedAds === 0 ? 'full' : 'none');
    context.window.googletag.pubads().setRequestNonPersonalizedAds(nonPersonalizedAds);

    context.logger.debug('GAM', `googletag setRequestNonPersonalizedAds(${nonPersonalizedAds})`);
    if (nonPersonalizedAds) {
      context.logger.debug('GAM', 'Serve non-personalized ads');
    }
  });
});
