import { AdSlot } from '../types/moliConfig';

/**
 * Create the ad slot that a `refreshInfiniteAdSlot` call refers to.
 *
 * An infinite ad slot is never configured on its own. The publisher configures a single slot with an
 * `infinite` loading behaviour that acts as a template, and every call names that template plus the
 * artificial domId of the element that should be filled. The resulting slot is the template with the
 * artificial domId.
 *
 * @param configuredSlot the configured ad slot with an 'infinite' loading behaviour
 * @param artificialDomId the artificial domId of the new infinite ad slot
 */
export const mkInfiniteSlot = (configuredSlot: AdSlot, artificialDomId: string): AdSlot => ({
  ...configuredSlot,
  domId: artificialDomId
});
