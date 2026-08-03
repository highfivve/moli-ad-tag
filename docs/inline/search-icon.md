The search icon placement renders a small, self-contained search button inside a target element. Unlike the search embed, it does not display a visible text input. Instead, it shows an icon, a label, or both. When a user clicks it, the search overlay opens. This placement works well in navigation bars, toolbars, and any space-constrained area where a full input bar would not fit.

## Mounting the placement

Pass `Placement.SearchIcon` as the first argument to `mount()`, followed by the target element and an options object.

```javascript
window.InlineAI.mount(
  window.InlineAI.Placement.SearchIcon,
  'nav-search',
  {
    label: 'Search',
    shouldShowIcon: true,
    buttonWidth: '120px',
    buttonHeight: '40px',
  }
);
```

The target can be a string element ID, a CSS selector, or a dynamic matcher object. The call returns a placement ID you can pass to `unmount()`.

> The search icon placement requires a target element. If you want a floating button that is not anchored to any container, use the [Search FAB](/placements/search-fab) placement instead.

## Mounting from the command queue

To mount from your page markup rather than after the script has loaded, push the command onto the [command queue](/guides/command-queue). Entries are buffered and replayed in order once the SDK is ready.

```html
<script>
  window.InlineAI = window.InlineAI || {};
  window.InlineAI.cmd = window.InlineAI.cmd || [];

  // init() activates programmatic mode
  window.InlineAI.cmd.push(['init', { publisherId: 'YOUR_PUBLISHER_ID' }]);

  window.InlineAI.cmd.push(['mount', 'search-icon', 'nav-search', {
    label: 'Search',
    shouldShowIcon: true,
  }]);
</script>
```

Place that block **before** the embed snippet.

> Pass the placement as the string `'search-icon'` here rather than `window.InlineAI.Placement.SearchIcon`. The enums are installed by the script itself, so they are not available to code that runs before it. See [enums and the command queue](/guides/command-queue#enums-and-the-command-queue).

## Targeting the container

```javascript
// By element ID
window.InlineAI.mount(window.InlineAI.Placement.SearchIcon, 'nav-search');

// By CSS selector
window.InlineAI.mount(window.InlineAI.Placement.SearchIcon, {
  selector: '.site-header .search-trigger',
});
```

## Options

### Button appearance

- `label` (string): Text label displayed on the button. If omitted, the button shows only the icon (if `shouldShowIcon` is `true`).

- `shouldShowIcon` (boolean): Whether to display the search icon on the button. Defaults to showing the icon.

- `buttonWidth` (string): Width of the button as a CSS value (e.g. `"120px"`, `"100%"`).

- `buttonHeight` (string): Height of the button as a CSS value (e.g. `"40px"`).

- `maxWidth` (string): Maximum width of the button as a CSS value.

- `maxHeight` (string): Maximum height of the button as a CSS value.

### Search overlay

- `placeholder` (string): Placeholder text shown in the search input when the overlay opens.

- `overlayType` (OverlayType): How the search overlay appears. `window.InlineAI.OverlayType.Modal` centers it over the page; `window.InlineAI.OverlayType.Drawer` slides it in from the side.

- `backdropOpacity` (number): Opacity of the backdrop behind the overlay, between `0` and `1`.

- `openOverlayOn` (OpenOverlayOn): When to open the search overlay. `window.InlineAI.OpenOverlayOn.Focus` opens it on focus; `window.InlineAI.OpenOverlayOn.QuerySubmit` opens it after query submission.

- `shouldShowSuggestedQuestions` (boolean): Whether to display suggested questions in the search overlay.

- `suggestedQuestionsMode` (SuggestedQuestionsMode): How to display suggested questions: `"animated"` cycles through them, `"static"` shows them all.

- `typographySource` (TypographySource): Typography inheritance mode: `"inherit-from-website"` or `"inherit-from-theme"`.

- `overlayBreakpoints` (OverlayBreakpointConfig[]): Per-viewport overrides for `overlayType`, `backdropOpacity`, and `openOverlayOn`.

## Full example

```javascript
window.InlineAI.mount(
  window.InlineAI.Placement.SearchIcon,
  'nav-search',
  {
    label: 'Search',
    shouldShowIcon: true,
    buttonWidth: '120px',
    buttonHeight: '40px',
    overlayType: window.InlineAI.OverlayType.Modal,
    backdropOpacity: 0.5,
  }
);
```

For unmounting and SPA routing patterns, see the [programmatic control guide](/guides/programmatic-control).
