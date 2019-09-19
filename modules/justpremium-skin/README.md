# JustPremium Skin / Wallpaper Module

This module allows us to configure `prebidResponse` listener that when a just premium wallpaper has won the auction

- removes certain other ad units
- hides the ad slot div where the skin was requested

## Integration
   
In your `index.ts` import the justpremium-skin and register the module.


```javascript
import JustPremium from '@highfivve/modules/justpremium-skin'

moli.registerModule(new JustPremium({
  wallpaperAdSlotDomId: 'ad-Billboard',
  blockedAdSlotDomIds: [ 'ad-Skyscraper' ],
  hideWallpaperAdSlot: true
}));
```

