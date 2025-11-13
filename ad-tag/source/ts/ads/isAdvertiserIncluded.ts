import { googletag } from '../../../lib';
import ISlotRenderEndedEvent = googletag.events.ISlotRenderEndedEvent;

/**
 * Checks if an ad event's advertiser or any of its company IDs are included in a given list (e.g. disallowedAdvertisers list of a module).
 *
 * @param event - The slot render ended event containing `advertiserId` and optional `companyIds`.
 * @param advertisersList - Array of advertiser IDs to check against.
 * @returns `true` if the event's `advertiserId` is in the list, or if any `companyIds` are in the list; otherwise, `false`.
 */
export const isAdvertiserIncluded = (
  event: ISlotRenderEndedEvent,
  advertisersList: number[]
): boolean => {
  const { advertiserId, companyIds } = event;
  return (
    (!!advertiserId && advertisersList.includes(advertiserId)) ||
    (!!companyIds && advertisersList.some(id => companyIds.includes(id)))
  );
};
