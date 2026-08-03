The search FAB (floating action button) placement renders a persistent, floating button that users can click to open the AI search overlay. Unlike the [search embed](/placements/search-embed) and [search icon](/placements/search-icon) placements, the search FAB is a body-level placement: it attaches directly to `document.body` and does not require you to designate a container element. You control its horizontal position and offsets from the page edges using the `fabPosition` option.

## Mounting the placement

Because the search FAB is a body-level placement, you can omit the target argument entirely. Pass `Placement.SearchFab` and an options object:

```javascript
window.InlineAI.mount(
  window.InlineAI.Placement.SearchFab,
  undefined,
  {
    fabPosition: {
      horizontalPosition: window.InlineAI.FabPosition.Right,
      rightOffset: '20px',
      bottomOffset: '24px',
    },
  }
);
```

Passing `undefined` as the target makes it clear the placement does not need one. You can also omit the target argument entirely:

```javascript
window.InlineAI.mount(window.InlineAI.Placement.SearchFab);
```

> The search FAB attaches to `document.body`. It renders over your page content and does not affect your page layout.

## Mounting from the command queue

The calls above assume the Inline AI script has already loaded. To mount the FAB from your page markup instead, push the command onto the [command queue](/guides/command-queue). Entries are buffered and replayed in order as soon as the SDK is ready, so you never have to detect whether the script has finished loading.

```html
<script>
  window.InlineAI = window.InlineAI || {};
  window.InlineAI.cmd = window.InlineAI.cmd || [];

  // init() activates programmatic mode
  window.InlineAI.cmd.push(['init', { publisherId: 'YOUR_PUBLISHER_ID' }]);

  window.InlineAI.cmd.push(['mount', 'search-fab', undefined, {
    fabPosition: {
      horizontalPosition: 'right',
      rightOffset: '20px',
      bottomOffset: '24px',
    },
  }]);
</script>
```

Place that block **before** the embed snippet. Because the search FAB needs no container element, this is the whole integration: no target `<div>` and no wait for `DOMContentLoaded`.

> Pass the placement as the string `'search-fab'` here rather than `window.InlineAI.Placement.SearchFab`. The enums are installed by the script itself, so they are not available to code that runs before it. See [enums and the command queue](/guides/command-queue#enums-and-the-command-queue).

## FAB position options

Use the `fabPosition` object to control where the button appears.

- `fabPosition.horizontalPosition` (FabPosition): Horizontal position of the FAB. Use `window.InlineAI.FabPosition.Left` (`"left"`), `window.InlineAI.FabPosition.Right` (`"right"`), or `window.InlineAI.FabPosition.Center` (`"center"`).

- `fabPosition.leftOffset` (string): Distance from the left edge of the viewport as a CSS value (e.g. `"20px"`). Applies when `horizontalPosition` is `Left` or `Center`.

- `fabPosition.rightOffset` (string): Distance from the right edge of the viewport as a CSS value (e.g. `"20px"`). Applies when `horizontalPosition` is `Right` or `Center`.

- `fabPosition.bottomOffset` (string): Distance from the bottom edge of the viewport as a CSS value (e.g. `"24px"`).

- `fabPosition.maxWidth` (string): Maximum width of the FAB button as a CSS value.

## Search overlay options

The search FAB shares search overlay options with the other search placements.

- `placeholder` (string): Placeholder text shown in the search input when the overlay opens.

- `overlayType` (OverlayType): How the search overlay appears. `window.InlineAI.OverlayType.Modal` (`"modal"`) or `window.InlineAI.OverlayType.Drawer` (`"drawer"`).

- `backdropOpacity` (number): Opacity of the overlay backdrop, between `0` and `1`.

- `openOverlayOn` (OpenOverlayOn): When to open the overlay: `window.InlineAI.OpenOverlayOn.Focus` or `window.InlineAI.OpenOverlayOn.QuerySubmit`.

- `shouldShowSuggestedQuestions` (boolean): Whether to show suggested questions in the overlay.

- `suggestedQuestionsMode` (SuggestedQuestionsMode): Display mode for suggested questions: `"animated"` or `"static"`.

- `typographySource` (TypographySource): Typography inheritance: `"inherit-from-website"` or `"inherit-from-theme"`.

- `overlayBreakpoints` (OverlayBreakpointConfig[]): Per-viewport overrides for overlay settings.

## Positioning examples

```javascript Bottom-right (default)
window.InlineAI.mount(window.InlineAI.Placement.SearchFab, undefined, {
  fabPosition: {
    horizontalPosition: window.InlineAI.FabPosition.Right,
    rightOffset: '20px',
    bottomOffset: '24px',
  },
});
```

```javascript Bottom-left
window.InlineAI.mount(window.InlineAI.Placement.SearchFab, undefined, {
  fabPosition: {
    horizontalPosition: window.InlineAI.FabPosition.Left,
    leftOffset: '20px',
    bottomOffset: '24px',
  },
});
```

```javascript Bottom-center
window.InlineAI.mount(window.InlineAI.Placement.SearchFab, undefined, {
  fabPosition: {
    horizontalPosition: window.InlineAI.FabPosition.Center,
    bottomOffset: '24px',
  },
});
```

> If your page has a fixed footer or bottom navigation bar, increase `bottomOffset` to prevent the FAB from overlapping it.

For unmounting and SPA routing patterns, see the [programmatic control guide](/guides/programmatic-control).
