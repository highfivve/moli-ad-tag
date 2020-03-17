# Generic Skin / Wallpaper Module

This module allows us to configure `prebidResponse` listener that when a just premium or dspx wallpaper has won the auction

- removes certain other ad units
- hides the ad slot div where the skin was requested

## Integration

In your `index.ts` import the generic-skin module and register it.


```javascript
import Skin from '@highfivve/modules/generic-skin'

moli.registerModule(new Skin({
  configs: [
    // configuration for regular wallpaper/skin from JustPremium or Screen on Demand (DSPX) 
    {
      formatFilter: [
        { bidder: 'justpremium', format: 'wp' },
        { bidder: 'dspx' },
      ],
      skinAdSlotDomId: 'my_header',
      hideSkinAdSlot: false,
      blockedAdSlotDomIds: [
        'my_sidebar_1',
        'my_sidebar_2',
        'my_sidebar_left',
        'my_floorad'
      ]
    }
  ]
}, window));
```
