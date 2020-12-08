# Yield Optimization

This module allows you to apply floor prices to all supporting bidders and setting
a unified pricing rule for GAM.

## Requirements

- Unified pricing rules setup in GAM
- Server providing the yield configuration

## Integration

In your `index.ts` import the generic-skin module and register it.

### Dynamic optimization

This requires and endpoint that provides the yield config.

```javascript
import YieldOptimization from '@highfivve/modules/yield-optimization'

moli.registerModule(new YieldOptimization({
  provider: 'dynamic',
  configEndpoint: 'https://yield.h5v.eu/config/gutefrage'
}, window));
```

### Static

For local testing or base settings you can define static rules.

```javascript
import YieldOptimization from '@highfivve/modules/yield-optimization'

moli.registerModule(new YieldOptimization({
  provider: 'static',
  config: {
    rules: {
      'ad-unit-dom-id-1': {
        priceRuleId: 123,
        floorpirce: 0.1,
        main: true
      }
    }
  }
}, window));
```

### None

If you want to turn off the optimization you can also provide `none`

```javascript
import YieldOptimization from '@highfivve/modules/yield-optimization'

moli.registerModule(new YieldOptimization({  provider: 'none'}, window));
```
