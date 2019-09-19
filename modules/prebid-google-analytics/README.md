# Prebid Google Analytics Module

This module configures the prebid google analytics adapter and the necessary google analytics setup.

## Requirements

The publisher loads google universal analytics.

## Integration

1. Install google analytics typings with 
   ```bash
   $ yarn add --dev @types/google.analytics
   ```
2. In your `index.ts` import and register the module.
   ```javascript
   import PrebidGoogleAnalytics from '@highfivve/modules/prebid-google-analytics';
   
   moli.registerModule(new PrebidGoogleAnalytics({
     trackingId: 'UA-965201-41',
     options: {
       global: 'ga', // only necessary if it's not ga
       trackerName: 'h5', // sets up a new tracker with this name
       sampling: 1, // set sampling to something appropriate
       enableDistribution: true // enables events for load time distribution
     }
   }, window));
   ```
3. And finally add the `googleAnalyticsAdapter` to the prebid `modules.json`


## Resources

- [prebid google analytics](http://prebid.org/overview/ga-analytics.html)
- [google analytics for developers](https://developers.google.com/analytics/devguides/collection/analyticsjs/)
- [google analytic types](https://www.npmjs.com/package/@types/google.analytics)
- [prebid google analytics adapter js](https://github.com/prebid/Prebid.js/blob/2.33.0/modules/googleAnalyticsAdapter.js)
- [prebid publisher api `pbjs.enableAnalytics`](http://prebid.org/dev-docs/publisher-api-reference.html#module_pbjs.enableAnalytics)