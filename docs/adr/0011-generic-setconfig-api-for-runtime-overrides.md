# Runtime overrides gain a generic `setConfig()`, alongside — not replacing — per-field setters

`MoliTag` already has dedicated runtime-override methods for individual `runtimeConfig`
fields: `setTargeting(key, value)`, `addLabel(label)`, `setAdUnitPathVariables(variables)`,
`setAudience(audience)`. Ad Volume (see `CONTEXT.md`) needed a runtime override too, but
rather than adding a fifth one-off `setAdVolume(volume)`, we introduced a generic
`setConfig(partial: { adVolume?: number })` — modeled after `pbjs.setConfig`/
`googletag.setConfig` — that merges a partial object into `runtimeConfig`. It is explicitly
designed to grow more optional fields (`labels`, `adUnitPathVariables`, `targetings`) over
time.

This is a deliberate second pattern living next to the first, not a replacement: existing
per-field setters stay as they are. We picked this over a sixth-and-onward one-off method
because moli's runtime-override surface was starting to accumulate a new public method per
field, and `setConfig` gives future fields (which don't yet have a proven need for their own
verb-shaped method) a landing spot without growing the `MoliTag` interface every time. Fields
that earn dedicated behavior beyond "assign into `runtimeConfig`" (e.g. `addLabel`'s
additive-not-overwriting semantics) still get their own method — `setConfig` is for plain
overwrite-on-set fields only.

Precedence between `setConfig()` and the dedicated setters, and between multiple `setConfig()`
calls, is unspecified beyond ordinary last-write-wins call order — there is no priority system,
matching how `setTargeting`/`addLabel` already behave.

## Addendum (GD-10299): `labels`/`targeting` moved into `setConfig()` after all

The paragraph above drew the line at fields with "dedicated behavior beyond assign into
`runtimeConfig`" — explicitly citing `addLabel`'s additive semantics as the kind of thing that
should keep its own method rather than join `setConfig`. GD-10299 revisited that call: `labels`
(append) and `targeting` (per-key merge into `keyValues`) were added to
`MoliRuntimeConfigOverrides`/`setConfig()` anyway, alongside `audience`/`adUnitPathVariables`
(plain full-replace, matching the original rule).

Reasoning: `setConfig`'s per-field application already has to special-case each field's merge
behavior once `adVolume`'s validation is factored in, so "no non-trivial semantics" wasn't buying
much isolation in practice — it was mostly avoiding a second place that knows how to append a
label or merge a key-value. That duplication already existed between `setConfig` and the dedicated
setters for the full-replace fields; extending it to the additive ones was judged cheaper than
growing `MoliTag`'s public surface with more one-off methods. The dedicated setters
(`addLabel`/`setTargeting`/`setAudience`/`setAdUnitPathVariables`) are unchanged and remain the
default recommendation in docs/examples — `setConfig` stays the "set several fields in one call"
escape hatch alongside them, not a replacement.
