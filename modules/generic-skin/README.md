# Generic Skin / Wallpaper Module

This module allows us to configure `prebidResponse` listener that when a just premium or dspx wallpaper has won the auction

- removes certain other ad units
- hides the ad slot div where the skin was requested

## Integration

In your `index.ts` import the generic-skin module and register it.


```javascript
import SkinModule from '@highfivve/modules/generic-skin'

moli.registerModule(new SkinModule({
  wallpaperAdSlotDomId: 'ad-Billboard',
  blockedAdSlotDomIds: [ 'ad-Skyscraper' ],
  hideWallpaperAdSlot: true
}, window));
```
