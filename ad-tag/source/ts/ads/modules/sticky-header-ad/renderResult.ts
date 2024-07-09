import { AdPipelineContext } from 'ad-tag/ads/adPipeline';
import { AdSlot } from 'ad-tag/types/moliConfig';
import { googletag } from 'ad-tag/types/googletag';

/**
 * empty: mobile sticky load was empty
 * disallowed: an advertiser that brings its own creative was rendered
 * standard: a regular creative was loaded
 */
export type RenderEventResult = 'empty' | 'disallowed' | 'standard';

export const adRenderResult = (
  ctx: AdPipelineContext,
  headerSlot: AdSlot,
  disallowedAdvertiserIds: number[],
  minVisibleDuration: number
) =>
  new Promise<RenderEventResult>(resolve => {
    // in test mode there's no event fired so we need to resolve immediately and say it's not empty
    if (ctx.env === 'test') {
      resolve('standard');
      return;
    }
    const listener: (event: googletag.events.ISlotRenderEndedEvent) => void = event => {
      // only the header slot is relevant
      if (event.slot.getSlotElementId() !== headerSlot.domId) {
        return;
      }

      // very similar to the footer sticky ads implementation. Can be merged once GD-8007 is on its way
      if (event.advertiserId && disallowedAdvertiserIds.includes(event.advertiserId)) {
        resolve('disallowed');
      } else if (event.isEmpty) {
        resolve('empty');
      } else {
        minVisibleDuration > 0
          ? ctx.window.setTimeout(() => resolve('standard'), minVisibleDuration)
          : resolve('standard');
      }
      ctx.window.googletag.pubads().removeEventListener('slotRenderEnded', listener);
    };

    ctx.window.googletag.pubads().addEventListener('slotRenderEnded', listener);
  });
