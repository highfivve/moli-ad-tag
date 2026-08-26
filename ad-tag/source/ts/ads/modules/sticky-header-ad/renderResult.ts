import { AdPipelineContext } from 'ad-tag/ads/adPipeline';
import { AdSlot, auction } from 'ad-tag/types/moliConfig';
import { googletag } from 'ad-tag/types/googletag';
import { isAdvertiserIncluded } from 'ad-tag/ads/isAdvertiserIncluded';
import { resolveAdUnitPath } from 'ad-tag/ads/adUnitPath';
import { isGamAnchor } from 'ad-tag/ads/auctions/anchorContext';

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
    // only needed to identify GAM's out-of-page anchor slot, so it is resolved lazily
    const resolvedAdUnitPath =
      channel === 'gam'
        ? resolveAdUnitPath(headerSlot.adUnitPath, ctx.adUnitPathVariables__)
        : null;

    // Identifies the event's slot as the one backing this position. On the `c` channel that is an
    // in-page slot carrying `headerSlot.domId` as its GPT element id. On the `gam` channel it is
    // an out-of-page anchor defined via `defineOutOfPageSlot`, which never carries the domId at
    // all (see ADR 0007) and can only be identified by its resolved ad unit path plus its anchor
    // format targeting.
    //
    // The ad unit path arm is deliberately limited to the `gam` channel: a stale anchor slot from
    // a previous cycle carries the same ad unit path *and* the same anchor format targeting, so on
    // the `c` channel it would otherwise hijack the in-page slot's render result.
    const isHeaderSlotEvent = (slot: googletag.IAdSlot): boolean =>
      slot.getSlotElementId() === headerSlot.domId ||
      (resolvedAdUnitPath !== null &&
        isGamAnchor(slot, ctx.window__) &&
        slot.getAdUnitPath() === resolvedAdUnitPath);

    const listener: (event: googletag.events.ISlotRenderEndedEvent) => void = event => {
      // only the header slot is relevant
      if (!isHeaderSlotEvent(event.slot)) {
        return;
      }

      if (channel === 'gam') {
        // GAM already serves this position as an out-of-page anchor - hide the custom container
        resolve('disallowed');
        // very similar to the footer sticky ads implementation. Can be merged once GD-8007 is on its way
      } else if (isAdvertiserIncluded(event, disallowedAdvertiserIds)) {
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
