The search embed placement renders a full-width search input bar directly inside a container element you specify. When a user interacts with it, the SDK opens a search overlay. You control the input shape, when the overlay opens, and how it appears (as a modal or a drawer). This placement is a good fit for prominent search areas like page headers, hero sections, or dedicated search pages.

## Mounting the placement

Pass `Placement.SearchEmbed` as the first argument to `mount()`, a target as the second, and an options object as the third.

```javascript
window.InlineAI.mount(
  window.InlineAI.Placement.SearchEmbed,
  'search-container',
  {
    placeholder: 'Search for answers...',
    shape: window.InlineAI.InputShape.RoundedRectangle,
    openOverlayOn: window.InlineAI.OpenOverlayOn.Focus,
  }
);
```

The target can be an element ID string, a CSS selector object, or a dynamic matcher. The call returns a placement ID string that you can pass to `unmount()` later.

> The search embed placement requires a target. If you want a search button that floats over the page without a container, use the [Search FAB](/placements/search-fab) placement instead.

## Mounting from the command queue

To mount from your page markup rather than after the script has loaded, push the command onto the [command queue](/guides/command-queue). Entries are buffered and replayed in order once the SDK is ready.

```html
<div id="search-container"></div>

<script>
  window.InlineAI = window.InlineAI || {};
  window.InlineAI.cmd = window.InlineAI.cmd || [];

  // init() activates programmatic mode
  window.InlineAI.cmd.push(['init', { publisherId: 'YOUR_PUBLISHER_ID' }]);

  window.InlineAI.cmd.push(['mount', 'search-embed', 'search-container', {
    placeholder: 'Search for answers...',
  }]);
</script>
```

Place that block **before** the embed snippet. The target `<div>` does not have to exist yet when you push the command; it only has to exist by the time the SDK loads.

> Pass the placement as the string `'search-embed'` here rather than `window.InlineAI.Placement.SearchEmbed`. The enums are installed by the script itself, so they are not available to code that runs before it. See [enums and the command queue](/guides/command-queue#enums-and-the-command-queue).

## Targeting the container

```javascript
// By element ID (shorthand)
window.InlineAI.mount(window.InlineAI.Placement.SearchEmbed, 'header-search');

// By CSS selector
window.InlineAI.mount(window.InlineAI.Placement.SearchEmbed, {
  selector: '[data-role="search"]',
});

// By dynamic element matching
window.InlineAI.mount(window.InlineAI.Placement.SearchEmbed, {
  dynamic: { tagName: 'div', attributeName: 'class', attributeValue: 'search-area' },
});
```

## Options

- `placeholder` (string): Placeholder text displayed inside the search input before the user types.

- `shape` (InputShape): Shape of the search input. Accepts `window.InlineAI.InputShape.Pill` (`"pill"`) or `window.InlineAI.InputShape.RoundedRectangle` (`"rounded-rectangle"`).

- `openOverlayOn` (OpenOverlayOn): When to open the search overlay. Use `window.InlineAI.OpenOverlayOn.Focus` (`"onFocus"`) to open as soon as the input receives focus, or `window.InlineAI.OpenOverlayOn.QuerySubmit` (`"onQuerySubmit"`) to open only after the user submits a query.

- `overlayType` (OverlayType): How the search overlay appears. `window.InlineAI.OverlayType.Modal` (`"modal"`) centers it over the page; `window.InlineAI.OverlayType.Drawer` (`"drawer"`) slides it in from the side.

- `backdropOpacity` (number): Opacity of the backdrop behind the overlay, as a number between `0` and `1`.

- `shouldShowSuggestedQuestions` (boolean): Whether to show suggested questions in the search overlay.

- `suggestedQuestionsMode` (SuggestedQuestionsMode): Display mode for suggested questions. `"animated"` cycles through them; `"static"` shows them all at once.

- `typographySource` (TypographySource): Where the placement inherits its typography. `"inherit-from-website"` uses your site's fonts; `"inherit-from-theme"` uses the Inline AI theme fonts.

- `overlayBreakpoints` (OverlayBreakpointConfig[]): Override overlay settings at specific viewport widths. Each entry can set `overlayType`, `backdropOpacity`, and `openOverlayOn`. The most specific (narrowest) matching breakpoint wins.

## Full example

```javascript
window.InlineAI.mount(
  window.InlineAI.Placement.SearchEmbed,
  'search-container',
  {
    placeholder: 'Search for answers...',
    shape: window.InlineAI.InputShape.RoundedRectangle,
    openOverlayOn: window.InlineAI.OpenOverlayOn.Focus,
    overlayType: window.InlineAI.OverlayType.Modal,
    backdropOpacity: 0.6,
    overlayBreakpoints: [
      {
        maxViewportWidth: 767,
        overlayType: window.InlineAI.OverlayType.Drawer,
        backdropOpacity: 1.0,
      },
    ],
  }
);
```

> Use `overlayBreakpoints` to show a modal on desktop and a full-screen drawer on mobile. Set `maxViewportWidth: 767` on the mobile breakpoint and `minViewportWidth: 768` on the desktop breakpoint.

For unmounting and SPA routing patterns, see the [programmatic control guide](/guides/programmatic-control).
