import type { MoliRuntime } from 'ad-tag/types/moliRuntime';
import type { EventTracker, Event } from 'ad-tag/ads/modules/moli-analytics/types';

/**
 * Creates an event tracker.
 * @param url - Events collection URL.
 * @param batchSize - Number of events to send in a single batch.
 * @param batchDelay - Time (in milliseconds) to wait before calling url with an incomplete batch.
 * @param logger - Logger.
 */
export const createEventTracker = (
  url: string,
  batchSize: number,
  batchDelay: number,
  logger?: MoliRuntime.MoliLogger
): EventTracker => {
  let batch: Event[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  const processBatch = () => {
    const currentBatch = batch;
    batch = [];
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ events: currentBatch })
    })
      .then(response => {
        if (response.ok) {
          logger?.debug(
            `moli-analytics: Successfully sent analytics batch of ${currentBatch.length} events`
          );
        } else {
          logger?.error(`moli-analytics: Failed to send analytics batch: ${response.statusText}`);
        }
      })
      .catch(error => {
        logger?.error(`moli-analytics: Failed to send analytics batch: ${error}`);
      });
  };

  const track = (event: Event) => {
    logger?.debug('moli-analytics: event', event);
    batch.push(event);
    if (timer != null) {
      clearTimeout(timer);
      timer = null;
    }
    if (batch.length >= batchSize) {
      processBatch();
    } else {
      timer = setTimeout(processBatch, batchDelay);
    }
  };

  return {
    track
  };
};
