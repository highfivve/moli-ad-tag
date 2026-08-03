Auto mode handles placement rendering for most sites, but some scenarios require direct control: single-page apps that need to mount and unmount placements as routes change, custom UI triggers that open search from your own buttons, or dynamic content pages where the right moment to render a placement depends on runtime conditions. This guide covers the full programmatic API for controlling what renders, when it renders, and how it opens.

## When to use programmatic control

- Single-page apps: Mount placements after route changes and unmount them before navigating away to avoid stale placements.
- Custom search triggers: Open the search overlay from your own nav bar, keyboard shortcut, or CTA button.
- Dynamic content: Mount placements only after your content has loaded or a user has reached a certain scroll depth.
- Full lifecycle control: Use `destroy()` and `init()` to completely reset the SDK between page transitions.

## Initializing in programmatic mode

In programmatic mode, the SDK does not auto-render placements from your dashboard config. You call `init()` explicitly, then mount each placement you want.

```js
// Set up the queue before the script tag
window.InlineAI = window.InlineAI || {};
window.InlineAI.cmd = window.InlineAI.cmd || [];

window.InlineAI.cmd.push(['init', { publisherId: 'YOUR_PUBLISHER_ID' }]);
```

> Calling `init()` before the SDK loads (either via the command queue or inline) activates programmatic mode. The SDK will not render anything automatically until you call `mount()`.

## Mounting placements

### Mounting on the ready event

The `Events.Ready` event fires once the SDK is initialized and accepting `mount()` calls. This is the right place to mount your initial set of placements.

```js
window.InlineAI.on(window.InlineAI.Events.Ready, function() {
  window.InlineAI.mount(window.InlineAI.Placement.SearchEmbed, 'search-box');
  window.InlineAI.mount(window.InlineAI.Placement.Widget);
});
```

### Mounting by element ID

Pass a string to mount a placement into a specific element by its `id` attribute.

```js
// Mounts into <div id="sidebar"></div>
var id = window.InlineAI.mount(window.InlineAI.Placement.KeyTakeaways, 'sidebar');
```

`mount()` returns a placement ID string. Save it if you need to unmount the placement later.

### Body-level placements

`Placement.SearchFab` and `Placement.Widget` attach to the page body and do not require a target element.

```js
window.InlineAI.mount(window.InlineAI.Placement.SearchFab);
window.InlineAI.mount(window.InlineAI.Placement.Widget);
```

## Unmounting placements

Call `unmount()` with the ID returned by `mount()` to remove a placement from the page.

```js
var id = window.InlineAI.mount(window.InlineAI.Placement.BasicEmbed, 'sidebar');

// Later, e.g. before a route change in an SPA
window.InlineAI.unmount(id);
```

> After calling `unmount()`, the placement ID is no longer valid. If you need the placement again, call `mount()` to get a new ID.

## Inspecting mounted placements

`getPlacements()` returns an array of all currently mounted placements. Each object contains the placement ID, type, and the DOM container element.

```js
var placements = window.InlineAI.getPlacements();
placements.forEach(function(p) {
  console.log(p.id, p.type, p.container);
});
```

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Placement ID, usable with `unmount()` |
| `type` | `string` | Placement type (e.g. `'search-embed'`) |
| `container` | `HTMLElement` | The DOM element hosting the placement |

> `getPlacements()` is not available through the command queue before the SDK loads. Call it only after the `Events.Ready` event has fired.

## Opening overlays programmatically

### Open search with a pre-filled query

You can open the search overlay from any event handler and optionally pre-fill a query string. This is useful for "search for this" links or contextual CTAs.

```js
document.getElementById('my-search-btn').addEventListener('click', function() {
  window.InlineAI.open(window.InlineAI.OverlayTarget.Search, 'How do I get started?');
});
```

Omit the query argument to open search with an empty input.

```js
window.InlineAI.open(window.InlineAI.OverlayTarget.Search);
```

### Open and close the widget

By default, opening the widget with `open(OverlayTarget.Widget)` **auto-answers** the current catalog question when one is available — same behavior as the user tapping **See Answer** on the FAB notification. To open the panel only without starting a stream, pass `{ autoAnswer: false }`.

```js
// Open the sticky widget panel (auto-answer when a catalog question is pending)
window.InlineAI.open(window.InlineAI.OverlayTarget.Widget);

// Open only — user interacts with suggested questions manually
window.InlineAI.open(window.InlineAI.OverlayTarget.Widget, { autoAnswer: false });

// Close it programmatically
window.InlineAI.close(window.InlineAI.OverlayTarget.Widget);
```

### Open search with auto-answer

The same `autoAnswer` option works for the search overlay. By default, `open(OverlayTarget.Search)` picks the next pending catalog question and auto-submits it. Pass an explicit `{ query }` to submit a specific question instead, or `{ autoAnswer: false }` to open the overlay empty.

```js
// Auto-answer: opens search and submits the next catalog question
window.InlineAI.open(window.InlineAI.OverlayTarget.Search);

// Submit a specific question
window.InlineAI.open(window.InlineAI.OverlayTarget.Search, { query: 'How do I get started?' });

// Open empty — let the user type
window.InlineAI.open(window.InlineAI.OverlayTarget.Search, { autoAnswer: false });
```

### Close search

```js
window.InlineAI.close(window.InlineAI.OverlayTarget.Search);
```

## SPA route change pattern

When navigating between routes in a single-page app, unmount the current placements, then mount the ones appropriate for the new route.

```js
// On route change (pseudo-code; adapt to your router)
function onRouteChange(newRoute) {
  // Remove all current placements
  var current = window.InlineAI.getPlacements();
  current.forEach(function(p) {
    window.InlineAI.unmount(p.id);
  });

  // Mount placements for the new route
  if (newRoute === '/articles') {
    window.InlineAI.mount(window.InlineAI.Placement.KeyTakeaways, 'article-sidebar');
    window.InlineAI.mount(window.InlineAI.Placement.SearchFab);
  } else if (newRoute === '/') {
    window.InlineAI.mount(window.InlineAI.Placement.SearchEmbed, 'hero-search');
  }
}
```

## Teardown and re-initialization

`destroy()` removes all placements and tears down the SDK completely. You can bring it back up with `init()`.

```js
// Full teardown
window.InlineAI.destroy();

// Re-initialize (e.g., after switching publisher context)
window.InlineAI.init({ publisherId: 'YOUR_PUBLISHER_ID' });
```

> Use `destroy()` followed by `init()` when you need to switch publisher IDs at runtime, or when a full reset is cleaner than individually unmounting every placement.
