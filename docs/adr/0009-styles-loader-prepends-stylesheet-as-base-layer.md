# Styles Loader prepends its stylesheet as `<head>`'s first child

The `styles` module injects a publisher's CSS via a `<link rel="stylesheet">` inserted as the
first child of `<head>`, rather than appended at the end like `assetLoaderService` does for
`<script>` tags. This is deliberate: it makes the injected stylesheet a base layer that any
CSS already in the page's `<head>` overrides on equal-specificity rules, since later DOM
position wins ties. The alternative — appending like scripts — would make moli's styles win
those ties instead, silently overriding a publisher's own equal-specificity rules the first
time this module is enabled. We accept that a publisher's `<head>` content injected *after*
page load (e.g. by another async script) will still be able to override this stylesheet
either way; this only orders it relative to what's already present at injection time.
