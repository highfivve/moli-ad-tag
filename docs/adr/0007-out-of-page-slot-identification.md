# Anchor/out-of-page GAM slots are identified by format targeting or resolved ad unit path, not domId

GD-10224 (GD-10225/GD-10226) needed to identify a specific live `googletag.IAdSlot` for two
purposes — viewability tracking should follow GAM's rendered `<ins>` element on the `gam` Anchor
Channel, and the cleanup module needs to destroy a stale anchor slot before it's redefined on
reload. Both started from a domId-based lookup and both were wrong, for the same reason:
`defineOutOfPageSlot` (used for anchor-bottom/top and interstitial whenever the format is
GAM-native) never passes moli's configured `domId` to GPT at all — GPT assigns its own
auto-generated element id at render time (`moliConfig.ts` already documented this for
interstitial: "auto-generated domId at runtime by gpt.js"). `slot.getSlotElementId() ===
config.domId` therefore never matches for these slots; it only works for the one `'out-of-page'`
custom-format case that does pass `domId` as the GPT element id.

**Viewability tracking (GD-10225)** does not use domId for the anchor case at all. It reads GAM's
own `format` (`f`) key-value targeting off the live slot (`slot.getTargeting(formatKey)`) — set on
every slot regardless of shape, either natively by GPT's `OutOfPageFormat` enum or by moli's own
custom sentinel constants when the same Position is instead rendered through the `c` Channel. A
Viewability Override's `conditions.format` compares against this raw Format Targeting Value
directly. Rejected: deriving the same distinction from Anchor Channel via a domId-keyed
auction-context lookup (`anchorChannelForDomId`) — it required per-module wiring
(`AdVisibilityService` needing anchor-domId awareness, a dynamic per-`trackSlot`-call override
computed from `slot.getAdUnitPath()`) that reading the slot's own targeting makes unnecessary, and
it doesn't generalize: Interstitial has no domId-scoped channel lookup at all, but does carry the
same `format` targeting.

**Cleanup's `destroySlot` deleteMethod (GD-10226)** keeps domId as an OR-fallback rather than
replacing it outright, matching the existing dual check already used in `bridge.ts`
(`slot.getSlotElementId() === domId || slot.getAdUnitPath() === adUnitPath`):
`GamSlotDeletionMethod` gains a required `adUnitPath` (resolved via `resolveAdUnitPath` and
`context.adUnitPathVariables__`, same as any other templated ad unit path), and the lookup becomes
`slot.getSlotElementId() === config.domId || slot.getAdUnitPath() === resolvedAdUnitPath`. This
keeps the already-correct `'out-of-page'` custom-format case working unchanged while fixing the
anchor/interstitial case, rather than maintaining two entirely separate lookup strategies split by
format.
