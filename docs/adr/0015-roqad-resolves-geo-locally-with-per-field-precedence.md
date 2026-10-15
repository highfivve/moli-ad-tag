# 15. The ROQAD module resolves Geo locally with per-field precedence

Date: 2026-10-15

## Status

Accepted

## Context

GD-10504 makes the ROQAD Cookie Sync send `ctry`, the ISO 3166-1 alpha-2 country code of the user.
ROQAD derives the country from the request IP when the parameter is absent, so a wrong value is
worse than no value.

moli has two sources for a country: the publisher's `targeting.geo` config and detection from the
browser timezone (`detectGeoFromTimezone`). Until now [Label] resolution in `moli.ts` was the only
consumer, and it combines the two as a **whole object**:

```ts
const { country, continent } = geoFromConfig ?? detectGeoFromBrowser(window);
```

A publisher that configures only `continent` therefore gets no country label at all — detection is
suppressed by the presence of the config object, not by the presence of the field.

ROQAD needs a country whenever one can be had: a geo config written for continent-level targeting
should not silently turn `ctry` off and push every sync onto IP-based attribution.

## Decision

### The module resolves Geo itself, per field

`roqad` reads `context.config__.targeting?.geo?.country` and falls back to
`detectGeoFromBrowser(context.window__).country` **per field**: an empty or absent configured
country still yields the detected one. The module validates the result (uppercase, two letters)
and omits `ctry` with a warning otherwise.

`detectGeoFromBrowser` now takes the window instead of reading the global `Intl`, per the repo
convention that nothing touches the global window. Its parameter type is
`Window & Partial<Pick<typeof globalThis, 'Intl'>>` so that every window satisfies it without
widening `AdPipelineContext.window__`, `createMoliTag` and `initAdTag`; a window without `Intl`
yields no geo.

### Accepted drift: labels keep the whole-object fallback

`addGeoLabels` in `moli.ts` is unchanged. Two consumers now resolve Geo with different precedence
rules, which is a real inconsistency: for a config of `{ continent: 'europe' }` in `Europe/Vienna`,
the labels are `europe` only, while `ctry=AT` is sent. Changing the label behaviour would add
country labels to publishers who never had them and silently re-target their line items, which this
ticket does not call for.

### Rejected: resolved Geo on the ad pipeline context

The obvious fix — resolve Geo once in `moli.ts` and put the result on `AdPipelineContext` — would
remove the drift by construction. It was rejected for now:

- It only pays off with more than one consumer. Today there is exactly one module reading Geo.
- The two consumers want different precedence. A shared resolved value forces one rule on both,
  and the only rule that keeps labels backwards compatible is the whole-object one — which is the
  behaviour ROQAD must not have.
- `AdPipelineContext` is the widest interface in the ad tag. Adding a field for a single module
  makes every context stub and every pipeline step carry it.

## Consequences

- Geo precedence is now a per-consumer decision. The [Geo] term in `CONTEXT.md` says so explicitly
  so the next reader does not assume one rule.
- A publisher with a partial `targeting.geo` config sees detection fill the missing country for
  ROQAD but not for labels.
- **Revisit when a third Geo consumer appears.** Two consumers with two rules is tolerable drift;
  three is a shared resolution waiting to happen. At that point move the resolution onto the
  pipeline context (or a small `geoService`) and decide the precedence question once, including
  whether labels can migrate to per-field resolution.
