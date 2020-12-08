# Yield Optimization

This module allows you to apply floor prices to all supporting bidders and setting
a unified pricing rule for GAM.

## Requirements

- Unified pricing rules setup in GAM
- Server providing the yield configuration

## Integration

In your `index.ts` import the generic-skin module and register it.


```javascript
import YieldOptimization from '@highfivve/modules/yield-optimization'

moli.registerModule(new YieldOptimization());
```
