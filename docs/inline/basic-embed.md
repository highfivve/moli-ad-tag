The basic embed placement renders an AI-powered content block inside a container element you specify. It is the most straightforward targeted placement: point it at a `div`, pass any sizing options you need, and the SDK handles the rest. Use it when you want to surface contextually relevant AI content in a sidebar, below an article, or anywhere else on your page.

## Mounting the placement

Pass `Placement.BasicEmbed` and a target to `mount()`. The target can be a string element ID for the simplest case:

```javascript
window.InlineAI.mount(window.InlineAI.Placement.BasicEmbed, 'content-sidebar');
```

The call returns a placement ID string you can later pass to `unmount()`.

> The basic embed placement requires a target. Make sure the target element exists in the DOM before calling `mount()`. If you are mounting after a dynamic page load, wait for the element to appear before mounting.

## Mounting from the command queue

To mount from your page markup rather than after the script has loaded, push the command onto the [command queue](/guides/command-queue). Entries are buffered and replayed in order once the SDK is ready.

```html
<div id="content-sidebar"></div>

<script>
  window.InlineAI = window.InlineAI || {};
  window.InlineAI.cmd = window.InlineAI.cmd || [];

  // init() activates programmatic mode
  window.InlineAI.cmd.push(['init', { publisherId: 'YOUR_PUBLISHER_ID' }]);

  window.InlineAI.cmd.push(['mount', 'basic-embed', 'content-sidebar']);
</script>
```

Place that block **before** the embed snippet.

> Pass the placement as the string `'basic-embed'` here rather than `window.InlineAI.Placement.BasicEmbed`. The enums are installed by the script itself, so they are not available to code that runs before it. See [enums and the command queue](/guides/command-queue#enums-and-the-command-queue).

## Targeting the container

You have three options for specifying the target element.

```javascript Element ID
// Shorthand string: looks up by element ID
window.InlineAI.mount(window.InlineAI.Placement.BasicEmbed, 'content-sidebar');

// Equivalent using the object form
window.InlineAI.mount(window.InlineAI.Placement.BasicEmbed, {
  containerId: 'content-sidebar',
});
```

```javascript CSS selector
window.InlineAI.mount(window.InlineAI.Placement.BasicEmbed, {
  selector: 'main > aside:first-child',
});
```

```javascript Dynamic element matching
window.InlineAI.mount(window.InlineAI.Placement.BasicEmbed, {
  dynamic: {
    tagName: 'div',
    attributeName: 'class',
    attributeValue: 'content-area',
    elementIndex: 0,
  },
});
```

## Positioning and sizing

Use the injection target object to control where the placement renders relative to its container and how large it should be.

- `location` (InjectionLocation): Where to insert the placement relative to the target element. Options: - `"above"`: sibling before the target - `"below"`: sibling after the target - `"prepend"`: first child of the target - `"append"`: last child of the target Use `window.InlineAI.InjectionLocation` enum values (e.g. `InjectionLocation.Prepend`).

- `width` (string): Width of the placement container as a CSS value (e.g. `"100%"`, `"320px"`).

- `maxWidth` (string): Maximum width of the placement container as a CSS value.

- `height` (string): Height of the placement container as a CSS value.

- `maxHeight` (string): Maximum height of the placement container as a CSS value.

- `breakpoints` (BreakpointConfig[]): Responsive breakpoints. Each entry can set `minViewportWidth`, `maxViewportWidth`, `width`, and `height`. The placement only renders when a breakpoint matches the current viewport.

## Examples

```javascript Minimal
window.InlineAI.mount(window.InlineAI.Placement.BasicEmbed, 'content-sidebar');
```

```javascript With sizing and position
window.InlineAI.mount(window.InlineAI.Placement.BasicEmbed, {
  selector: '.article-sidebar',
  location: window.InlineAI.InjectionLocation.Prepend,
  width: '100%',
  maxWidth: '360px',
});
```

```javascript With responsive breakpoints
window.InlineAI.mount(window.InlineAI.Placement.BasicEmbed, {
  containerId: 'inline-content',
  breakpoints: [
    { minViewportWidth: 768, width: '360px' },
    { maxViewportWidth: 767, width: '100%' },
  ],
});
```

For unmounting and SPA routing patterns, see the [programmatic control guide](/guides/programmatic-control).
