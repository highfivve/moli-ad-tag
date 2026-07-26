# Shared waterfall-context factory (interstitial migration deferred)

Interstitial and the new anchor formats (top, bottom-mobile, bottom-desktop) all need the
same session-persisted, priority-array-with-shift-on-signal mechanics — they differ only in
*which* events trigger a shift (see [0004](./0004-anchor-waterfall-fail-only-rotation.md)).
Rather than copy-pasting `interstitialContext.ts` three more times, this logic is extracted
into a single generic `createWaterfallContext` factory parameterized by a rotation-policy
hook, and the three anchor instances are built from it.

`interstitialContext.ts` is deliberately left on its own bespoke implementation for now.
Migrating it onto the shared factory is out of scope for GD-10156 — retrofitting a factory
underneath existing production interstitial behavior carries its own regression risk and is
tracked as a separate follow-up ticket.
