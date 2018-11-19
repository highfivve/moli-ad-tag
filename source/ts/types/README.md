# Moli API Reference

This is the moli api documentation. It provides an overview over the provided types.

## [Moli Tag](interfaces/_moli_.moli.molitag.html)

The public API that should be used by publishers is the Moli tag.

## [Moli Config](interfaces/_moli_.moli.moliconfig.html)

This is "ad configuration", which contains all necessary information to request and render ads on the publisher page.


## Integration

All integrations require the following steps.

1. Add the `publisher-tag` to your page. This is a custom tag with a pre-bundled `MoliConfig`.
   **Example**:
   ```html
   <script src="cdn.highfivve.com/publisher/gutefrage/tag_fe31ea4c6dd.js" async/></script>
   ```
2. Add `gpt.js` to your page.
   ```html
   <script src="https://www.googletagservices.com/tag/js/gpt.js" async></script>
   ```



### Example: full automatic integration

Having integrated both tags, there's nothing else to do.


### Example: lazy initialization

You can customize the moli ad tag and trigger the actual ad rendering manually. This
covers the following use-cases

* add additional `key-values` and `labels` to the page
* set your own logging implementation
* add reporters for latency metrics

Due to the asynchronous nature the `moli-ad-tag` works with a command queue until the
tag has been fully loaded. Initialize the queue with

```html
<script>
window.moli = window.moli || { que: [] };
</script>
```

You can push arbitrary commands into this queue with

```html
<script>
window.moli.que.push(function(moliAdTag) => {
  moliAdTag.setTargeting('key', 'value');
  moliAdTag.requestAds();
});
</script>
```

You can use the [full Moli Tag API](interfaces/_moli_.moli.molitag.html). Note that the moli tag is always
in a certain state. Depending on the state, different actions are allowed. 
You can [learn more about all state transitions in the state module](modules/_moli_.moli.state.html).

#### Requesting Ads

This step is required in order to load ads:

```html
<script>
window.moli.que.push(function(moliAdTag) => {
  moliAdTag.requestAds();
});
</script>
```

#### Full example


```html
<script>
window.moli = window.moli || { que: [] };
window.moli.que.push(function(moliAdTag) => {
  moliAdTag.setTargeting('key', 'value');
  moliAdTag.addLabel('qdp');
  moliAdTag.requestAds();
});
</script>
```
