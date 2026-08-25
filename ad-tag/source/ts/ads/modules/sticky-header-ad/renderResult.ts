import { AdPipelineContext } from 'ad-tag/ads/adPipeline';
import { AdSlot, auction } from 'ad-tag/types/moliConfig';
import { googletag } from 'ad-tag/types/googletag';
import { isAdvertiserIncluded } from 'ad-tag/ads/isAdvertiserIncluded';

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
  channel: auction.AnchorChannel | undefined | null,
  minVisibleDuration: number
) =>
  new Promise<RenderEventResult>(resolve => {
    // in test mode there's no event fired so we need to resolve immediately and say it's not empty
    if (ctx.env__ === 'test') {
      resolve('standard');
      return;
    }
    // GAM already serves this position as an out-of-page anchor - hide the custom container.
    // This must be decided before the listener is registered: on the `gam` channel the slot is
    // defined via `defineOutOfPageSlot`, which never carries `headerSlot.domId` as its GPT
    // element id (see ADR 0007), so no slotRenderEnded event for this domId ever arrives and
    // waiting for one would leave the container visible on top of GAM's anchor.
    // very similar to the footer sticky ads implementation. Can be merged once GD-8007 is on its way
    if (channel === 'gam') {
      resolve('disallowed');
      return;
    }

    const listener: (event: googletag.events.ISlotRenderEndedEvent) => void = event => {
      // only the header slot is relevant
      if (event.slot.getSlotElementId() !== headerSlot.domId) {
        return;
      }

      if (isAdvertiserIncluded(event, disallowedAdvertiserIds)) {
        resolve('disallowed');
      } else if (event.isEmpty) {
        resolve('empty');
      } else {
        minVisibleDuration > 0
          ? ctx.window__.setTimeout(() => resolve('standard'), minVisibleDuration)
          : resolve('standard');
      }
      ctx.window__.googletag.pubads().removeEventListener('slotRenderEnded', listener);
    };

    ctx.window__.googletag.pubads().addEventListener('slotRenderEnded', listener);
  });
