import { modules } from 'ad-tag/types/moliConfig';

/**
 * Normalizes a `ViewabilityOverrides[domId]` value - a single entry, an ordered list, or
 * undefined - into a list, so resolution/display can treat both shapes uniformly.
 */
export const asViewabilityOverrideEntryList = (
  entryOrList:
    | modules.adreload.ViewabilityOverrideEntry
    | modules.adreload.ViewabilityOverrideEntry[]
    | undefined
): modules.adreload.ViewabilityOverrideEntry[] =>
  entryOrList === undefined ? [] : Array.isArray(entryOrList) ? entryOrList : [entryOrList];

/**
 * A condition with no fields set at all counts as "always matches" - same as an entry with no
 * `conditions` object. Every defined field on the condition must match (AND); OR is expressed by
 * adding another entry to the list, not by this condition itself.
 */
export const isViewabilityOverrideConditionMatch = (
  conditions: modules.adreload.ViewabilityOverrideCondition | undefined,
  liveFormat: string | undefined
): boolean => !conditions || conditions.format === undefined || conditions.format === liveFormat;

/**
 * Resolves the first entry in `entries` whose `conditions` matches the slot's live Format
 * Targeting Value - or that has no `conditions` at all. Entries are tried in order; the winner
 * replaces outright, never merges with the others.
 */
export const resolveViewabilityOverride = (
  entries: modules.adreload.ViewabilityOverrideEntry[],
  liveFormat: string | undefined
): modules.adreload.ViewabilityOverrideEntry | undefined =>
  entries.find(entry => isViewabilityOverrideConditionMatch(entry.conditions, liveFormat));
