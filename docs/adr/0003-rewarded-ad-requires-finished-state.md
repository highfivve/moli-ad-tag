# Rewarded Ad requires the `finished`/`spa-finished` state

`rewardedAd()` could in principle run standalone, lazy-loading its own scripts (`gpt.js`,
Welect bundle) independently of the main ad pipeline — a publisher might gate it behind a
button on a page with no regular ad slots at all.

We decided against that. `rewardedAd()` is gated on the same state machine as `refreshAdSlot()`:
calls made in `configurable` / `configured` / `requestAds` / `spa-requestAds` queue and resolve
once `finished` / `spa-finished` is reached; calls made in `error` resolve with an `error`
result rather than queueing forever. This ties Rewarded Ad to the main pipeline's `init` and
`configure` stages, which is where consent (CMP) is resolved and respected before any script
loads. Letting Rewarded Ad load its own scripts independently would risk firing GAM or Welect
requests before consent has been established.
