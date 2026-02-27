import { AdPipelineContext } from "ad-tag/ads/adPipeline";

export const extractPubstackAbTestCohort = (ctx: AdPipelineContext): string | null => {
    // these map to key-value values in GAM. Other values are not configured there and don't need to be sent along
    const pubstackABTestValues = ['0', '1', '2', '3'];
    if (ctx.env__ === 'test') {
      return null;
    }
    // find meta data
    const meta = ctx.window__.document.head.querySelector<HTMLMetaElement>(
      'meta[name="pbstck_context:pbstck_ab_test"]'
    );
    if (meta && meta.content && pubstackABTestValues.includes(meta.content)) {
      return meta.content;
    }
    return null;
  };


