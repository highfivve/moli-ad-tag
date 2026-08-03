The Inline AI script loads asynchronously, which means your JavaScript may run before the SDK is available on the page. The command queue solves this: it lets you call SDK methods immediately, buffering them until the SDK is ready to execute them in order. Once the script has loaded, any further calls to `cmd.push()` run right away. This guide explains how the queue works, which syntax to use, and how to structure your setup code correctly.

## How the command queue works

When you add the queue setup snippet before the script tag, you create a plain JavaScript array at `window.InlineAI.cmd`. Your calls to `cmd.push()` add entries to that array. When the Inline AI script loads, it reads every entry in the array, executes them in sequence, and then replaces `cmd` with a live dispatcher, so any subsequent `cmd.push()` calls execute immediately.

This pattern is intentionally simple: no special libraries, no build tools, no dependencies. It works in any browser that supports a basic `<script async>` tag.

## Setting up the queue

Place these two lines before the Inline AI `<script>` tag. The `|| {}` and `|| []` guards ensure the snippet is safe to include multiple times (for example, across independently loaded page sections).

```js
window.InlineAI = window.InlineAI || {};
window.InlineAI.cmd = window.InlineAI.cmd || [];
```

> Always initialize the queue **before** the `` tag. If the script loads before the queue exists, early commands are lost.

## Command syntax

The queue supports two ways to push commands.

### Array syntax

Pass an array where the first element is the method name as a string, followed by the method's arguments in order.

```js
// ['methodName', arg1, arg2, ...]
window.InlineAI.cmd.push(['init', { publisherId: 'YOUR_PUBLISHER_ID' }]);
window.InlineAI.cmd.push(['mount', 'search-fab']);
window.InlineAI.cmd.push(['on', 'search:open', function(data) {
  console.log('Searched:', data.query);
}]);
```

Array syntax is concise and maps directly to the method signatures in the [SDK API reference](/api/init). Pass placement types and event names as strings; see [enums and the command queue](#enums-and-the-command-queue).

### Callback syntax

Pass a function that receives the fully initialized `sdk` object as its first argument. Use this when you need to reference the return value of a method (such as the placement ID from `mount()`), or when you want to write several calls in one block with full IDE autocompletion support.

```js
window.InlineAI.cmd.push(function(sdk) {
  var id = sdk.mount(sdk.Placement.KeyTakeaways, '.sidebar');

  sdk.on(sdk.Events.WidgetOpen, function() {
    console.log('Widget opened, placement:', id);
  });
});
```

> Prefer callback syntax when you need the return value of `mount()` or when you're registering multiple related calls that belong together logically.

## Enums and the command queue

The `window.InlineAI.Placement`, `Events`, and other enum objects are installed by the Inline AI script. Your queue setup runs **before** that script, so at that point `window.InlineAI` is the bare `{}` your own snippet created and the enums are not there yet. Reading one throws:

```js
// Throws: Cannot read properties of undefined (reading 'SearchFab')
window.InlineAI.cmd.push(['mount', window.InlineAI.Placement.SearchFab]);
```

The SDK accepts the plain string values everywhere it accepts an enum, so use those in array syntax:

```js
window.InlineAI.cmd.push(['mount', 'search-fab']);
```

If you would rather keep the named constants, use callback syntax. The callback runs after the script has loaded, and the `sdk` argument carries the enums:

```js
window.InlineAI.cmd.push(function(sdk) {
  sdk.mount(sdk.Placement.SearchFab);
});
```

The string values are listed on the [placements overview](/placements/overview) and in the [enums reference](/api/enums).

> This applies only to code that runs before the script loads. Once the SDK is ready, `window.InlineAI.Placement.SearchFab` works normally.

## Supported methods

These methods are available through the command queue before the SDK script has loaded:

| Method | Array syntax example |
|---|---|
| `init` | `['init', { publisherId: 'YOUR_PUBLISHER_ID' }]` |
| `mount` | `['mount', 'search-fab']` |
| `unmount` | `['unmount', placementId]` |
| `open` | `['open', 'search']` (auto-answers pending catalog question by default) |
| `open` (search, specific query) | `['open', 'search', { query: 'my question' }]` |
| `open` (search, panel only) | `['open', 'search', { autoAnswer: false }]` |
| `open` (widget) | `['open', 'widget']` (auto-answers pending catalog question by default) |
| `open` (widget, panel only) | `['open', 'widget', { autoAnswer: false }]` |
| `close` | `['close', 'widget']` |
| `on` | `['on', 'search:open', handler]` |
| `off` | `['off', 'search:open', handler]` |
| `destroy` | `['destroy']` |

> `getPlacements()` is **not** available through the command queue before the SDK loads. Calling it pre-load will throw an error. Use it only after the `Events.Ready` event has fired.

## Behavior after SDK load

Once the Inline AI script has initialized, `cmd` is replaced with a live dispatcher. Any call to `cmd.push()` after that point executes the command immediately; there is no buffering delay.

```js
// After the SDK has loaded, this executes right away
window.InlineAI.cmd.push(['mount', window.InlineAI.Placement.BasicEmbed, 'new-container']);
```

This means you can safely use `cmd.push()` throughout your page code without worrying about whether the SDK has finished loading.

## Complete setup example

The following is a full working example. Place it before the `<script>` tag.

```js
// Step 1: Initialize the queue
window.InlineAI = window.InlineAI || {};
window.InlineAI.cmd = window.InlineAI.cmd || [];

// Step 2: Initialize in programmatic mode
window.InlineAI.cmd.push(['init', { publisherId: 'YOUR_PUBLISHER_ID' }]);

// Step 3: Mount placements using array syntax (string values, not the enums)
window.InlineAI.cmd.push(['mount', 'search-fab']);
window.InlineAI.cmd.push(['mount', 'search-embed', 'header-search', { placeholder: 'Search...' }]);

// Step 4: Subscribe to an event using array syntax
window.InlineAI.cmd.push(['on', 'search:open', function(data) {
  console.log('Searched:', data.query);
}]);

// Step 5: Use callback syntax for calls that need return values
window.InlineAI.cmd.push(function(sdk) {
  var id = sdk.mount(sdk.Placement.KeyTakeaways, '.sidebar');

  sdk.on(sdk.Events.WidgetOpen, function() {
    console.log('Widget opened, placement:', id);
  });
});
```

Then, after all the queue setup above, paste the embed snippet:

```html
<script>
  (function(d) {
    var s = d.createElement('script');
    s.type = 'module';
    s.src = 'https://getinline.tech/default/assets/index.js?key=YOUR_PUBLISHER_ID';
    (d.getElementsByTagName('head')[0] || d.getElementsByTagName('body')[0]).appendChild(s);
  })(window.top.document);
</script>
```

## Mixing array and callback syntax

You can freely mix both syntaxes in the same queue. Commands execute in the order they are pushed, regardless of which syntax was used.

```js
// Array syntax for simple calls
window.InlineAI.cmd.push(['init', { publisherId: 'YOUR_PUBLISHER_ID' }]);
window.InlineAI.cmd.push(['mount', 'widget']);

// Callback syntax where you need the placement ID
window.InlineAI.cmd.push(function(sdk) {
  var searchId = sdk.mount(sdk.Placement.SearchEmbed, 'search-area');

  sdk.on(sdk.Events.PlacementMount, function(info) {
    if (info.id === searchId) {
      console.log('Search embed is live');
    }
  });
});
```

## Best practices

#### Always set up the queue before the script tag

    If the Inline AI script loads before your queue initialization code runs, commands pushed before load will not be buffered. Put the queue setup and all your `cmd.push()` calls in a `<script>` block that appears before the `<script src="...">` tag.

#### Use callback syntax for event subscriptions in hybrid mode

    When using hybrid mode (auto placements + event hooks), the callback syntax gives you a clean `sdk` reference and ensures all your handlers are grouped in one place, making it easier to audit what you're tracking.

#### Do not call getPlacements() through the queue

    `getPlacements()` queries live DOM state and cannot be buffered. If you need to inspect mounted placements, listen for `Events.Ready` and call `window.InlineAI.getPlacements()` directly from that handler.

#### The queue is safe to re-initialize

    The `|| {}` and `|| []` guards on the initialization snippet mean it is idempotent. You can safely include the snippet in multiple page fragments or loaded modules without overwriting an existing queue.
