import { AdPipelineContext } from '../ads/adPipeline';

/**
 * Returns the maximum timeout within buckets.
 */

export const getMaxBucketTimeout = (context: AdPipelineContext): number => {
  if (context.config.buckets?.enabled && context.config.buckets.bucket) {
    const buckets = Object.values(context.config.buckets.bucket);
    return Math.max(...buckets.map(bucket => bucket.timeout));
  }
  return 0;
};
