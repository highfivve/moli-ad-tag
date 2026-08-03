The key takeaways placement renders an AI-generated summary of your page content inside a target element. It reads the article or long-form content on the page and produces a concise list of key points, giving readers a quick overview before they dive in. This placement is well suited for sidebars, article introductions, or any position near the top of your content where a summary adds value.

## Mounting the placement

Pass `Placement.KeyTakeaways` and a target to `mount()`. The target is typically a CSS selector or an element ID.

```javascript
window.InlineAI.mount(
  window.InlineAI.Placement.KeyTakeaways,
  {
    selector: '.article-sidebar',
    location: window.InlineAI.InjectionLocation.Prepend,
    maxWidth: '400px',
  }
);
```

The call returns a placement ID you can pass to `unmount()` later.

> The key takeaways placement requires a target. The SDK generates the summary based on the page's content, so the placement works best on pages with substantial readable text.

## Mounting from the command queue

To mount from your page markup rather than after the script has loaded, push the command onto the [command queue](/guides/command-queue). Entries are buffered and replayed in order once the SDK is ready.

```html
<script>
  window.InlineAI = window.InlineAI || {};
  window.InlineAI.cmd = window.InlineAI.cmd || [];

  // init() activates programmatic mode
  window.InlineAI.cmd.push(['init', { publisherId: 'YOUR_PUBLISHER_ID' }]);

  window.InlineAI.cmd.push(['mount', 'key-takeaways', {
    selector: '.article-sidebar',
    location: 'prepend',
    maxWidth: '400px',
  }]);
</script>
```

Place that block **before** the embed snippet.

> Pass the string values here (`'key-takeaways'`, `'prepend'`) rather than `window.InlineAI.Placement.KeyTakeaways` and `window.InlineAI.InjectionLocation.Prepend`. The enums are installed by the script itself, so they are not available to code that runs before it. See [enums and the command queue](/guides/command-queue#enums-and-the-command-queue).

## Targeting the container

```javascript Element ID
window.InlineAI.mount(window.InlineAI.Placement.KeyTakeaways, 'article-summary');
```

```javascript CSS selector
window.InlineAI.mount(window.InlineAI.Placement.KeyTakeaways, {
  selector: '.article-sidebar',
});
```

```javascript Dynamic element matching
window.InlineAI.mount(window.InlineAI.Placement.KeyTakeaways, {
  dynamic: {
    tagName: 'aside',
    attributeName: 'class',
    attributeValue: 'post-sidebar',
    elementIndex: 0,
  },
});
```

## Positioning and sizing

- `location` (InjectionLocation): Where to insert the placement relative to the target element: - `window.InlineAI.InjectionLocation.Above`: sibling before the target - `window.InlineAI.InjectionLocation.Below`: sibling after the target - `window.InlineAI.InjectionLocation.Prepend`: first child of the target - `window.InlineAI.InjectionLocation.Append`: last child of the target

- `width` (string): Width of the placement container as a CSS value (e.g. `"100%"`, `"400px"`).

- `maxWidth` (string): Maximum width of the placement container as a CSS value.

- `height` (string): Height of the placement container as a CSS value.

- `maxHeight` (string): Maximum height of the placement container as a CSS value.

- `breakpoints` (BreakpointConfig[]): Responsive breakpoints with `minViewportWidth`, `maxViewportWidth`, `width`, and `height` per entry.

## Examples

```javascript Minimal
window.InlineAI.mount(window.InlineAI.Placement.KeyTakeaways, 'article-summary');
```

```javascript Sidebar with max width
window.InlineAI.mount(window.InlineAI.Placement.KeyTakeaways, {
  selector: '.article-sidebar',
  location: window.InlineAI.InjectionLocation.Prepend,
  maxWidth: '400px',
});
```

```javascript Prepend to article
window.InlineAI.mount(window.InlineAI.Placement.KeyTakeaways, {
  dynamic: { tagName: 'article' },
  location: window.InlineAI.InjectionLocation.Prepend,
  width: '100%',
});
```

> Prepending the key takeaways block to your article container (using `InjectionLocation.Prepend`) places it above your content automatically, without needing a dedicated element in your HTML.

For unmounting and SPA routing patterns, see the [programmatic control guide](/guides/programmatic-control).
