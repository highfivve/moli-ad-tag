# Anchor waterfall rotates only on no-bid/empty response

The Interstitial Channel's waterfall rotates priority to the back on *every* attempt,
including a successful GAM render (`onImpressionViewable`) — not just on failure. That
exists because GAM applies a hard-wired frequency cap specifically to the Web Interstitial
out-of-page format, and rotating away from `gam` after every successful view is how the
ad tag works around that cap to still get a turn for the `c` (custom/header-bidding) channel.

Top and bottom anchor ad formats have no equivalent GAM-side frequency cap. The anchor
waterfall (top, bottom-mobile, bottom-desktop — one independent instance each) therefore
only shifts priority when the current channel returns an empty ad response (GAM) or no bid
(custom/prebid). The winning channel is kept as long as it keeps delivering.
