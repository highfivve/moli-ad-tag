# Moli API Reference

This is the moli api documentation. It provides an overview over the provided types.

## [Moli Tag](interfaces/_types_moli_.moli.molitag.html)

The public API that should be used by publishers is the Moli tag.

## [Moli Config](interfaces/_types_moli_.moli.moliconfig.html)

This is the "ad configuration", which contains all necessary information to request and render ads on the publisher page.

Most of the configuration is provided by Highfivve. The static part contains

- all ad slots and their settings (sizes, labels, prebid, a9)
- size configuration
- consent settings
- prebid settings
- a9 settings

If required the publisher can change certain settings. See the **Features** section for more details.

## Features

The moli publisher ad tag provides a minimal API for various uses cases. The publisher tag needs to be
configured in `publisher` mode, which means the publisher needs to trigger the `moli.requestAds()` call.

### Request Ads

The minimal amount of code that is required to trigger the ads in `publisher` mode.


```html
<script>
// initialize the command queue
window.moli = window.moli || { que: [] };
window.moli.que.push(function(moliAdTag) {
  // trigger ads
  moliAdTag.requestAds();
});
</script>
```

### API summary

- [`setTarget(key,value)`](interfaces/_types_moli_.moli.molitag.html#settargeting). Add dynamic key value pairs from the publisher site
- [`addLabel`](interfaces/_types_moli_.moli.molitag.html#addlabel). Add custom labels for ad slot filtering
- [`setLogger`](interfaces/_types_moli_.moli.molitag.html#setlogger). Provide a custom logger implementation
- [`addReporter`](interfaces/_types_moli_.moli.molitag.html#addreporter). Add custom reporting functions to measure general metrics and ad slot related metrics
- [`setSampleRate`](interfaces/_types_moli_.moli.molitag.html#setsamplerate). Restrict the number of metrics pushed to the configured reporters


The [`configure()`](interfaces/_types_moli_.moli.molitag.html#configure) method should never be called by the publisher. The ad tag contains the
static configuration. Use this method for initial testing during the integration face, but not in production.

## Integration

All integrations require the following steps.

1. Add the `publisher-tag` to your page. This is a custom tag with a pre-bundled `MoliConfig`.
   **Example**:
   ```html
   <script src="https://[publisher-name].h5v.eu/[version]/moli_[hash].js" async/></script>
   ```
2. Add `gpt.js` to your page.
   ```html
   <script src="https://www.googletagservices.com/tag/js/gpt.js" async></script>
   ```



### Example: full automatic integration (`instant` mode)

Having integrated both tags, there's nothing else to do.


### Example: lazy initialization (`publisher` mode)

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
window.moli.que.push(function(moliAdTag) {
  moliAdTag.setTargeting('key', 'value');
  moliAdTag.requestAds();
});
</script>
```

You can use the [full Moli Tag API](interfaces/_types_moli_.moli.molitag.html). Note that the moli tag is always
in a certain state. Depending on the state, different actions are allowed. 
You can [learn more about all state transitions in the state module](modules/_types_moli_.moli.state.html).

#### Requesting Ads

This step is required in order to load ads:

```html
<script>
window.moli.que.push(function(moliAdTag) {
  moliAdTag.requestAds();
});
</script>
```

#### Full example


```html
<script>
window.moli = window.moli || { que: [] };
window.moli.que.push(function(moliAdTag) {
  moliAdTag.setTargeting('key', 'value');
  moliAdTag.addLabel('qdp');
  moliAdTag.requestAds();
});
</script>
```
