The optional third argument to `mount()` is a `MountOptions` object that controls how a placement looks and behaves. Options are grouped by placement type: some apply to all search placements, others are exclusive to the search icon or floating action button. You can also configure how the search overlay opens and define per-viewport overrides with overlay breakpoints.

## Search placement options

#### Search embed and FAB

    These options apply to `SearchEmbed` and `SearchFab` placements. They control the search input appearance, suggested questions, and overlay behavior.

- `placeholder` (string): Placeholder text shown inside the search input before the user types.

- `shape` (string): Shape of the search input field. Accepts `'pill'` or `'rounded-rectangle'` (or the `InputShape` enum values `InputShape.Pill` / `InputShape.RoundedRectangle`).

- `shouldShowSuggestedQuestions` (boolean): When `true`, the SDK displays suggested questions below or alongside the search input.

- `suggestedQuestionsMode` (string): Controls how suggested questions are displayed. Accepts `'animated'` (cycle through questions) or `'static'` (show all at once).

- `typographySource` (string): Where the placement inherits its font styles from. Accepts `'inherit-from-website'` (matches the surrounding page) or `'inherit-from-theme'` (uses the Inline AI theme). Also available as `TypographySource.Website` / `TypographySource.Theme`.

- `overlayType` (string): How the search results overlay appears. Accepts `'modal'` (centered dialog) or `'drawer'` (slides in from the side). Also available as `OverlayType.Modal` / `OverlayType.Drawer`.

- `backdropOpacity` (number): Opacity of the backdrop behind the overlay. Accepts a value between `0` (fully transparent) and `1` (fully opaque).

- `openOverlayOn` (string): When the search overlay opens. Accepts `'onQuerySubmit'` (opens after the user submits a query) or `'onFocus'` (opens as soon as the input is focused). Also available as `OpenOverlayOn.QuerySubmit` / `OpenOverlayOn.Focus`.

    ```javascript
    var { Placement, InputShape, OpenOverlayOn, OverlayType } = window.InlineAI;

    window.InlineAI.mount(Placement.SearchEmbed, 'search-container', {
      placeholder: 'Search for answers...',
      shape: InputShape.RoundedRectangle,
      shouldShowSuggestedQuestions: true,
      suggestedQuestionsMode: 'animated',
      overlayType: OverlayType.Modal,
      backdropOpacity: 0.6,
      openOverlayOn: OpenOverlayOn.Focus,
    });
    ```

#### Search icon

    These options are exclusive to the `SearchIcon` placement: a compact button that opens the search overlay when clicked.

- `label` (string): Text label displayed on the search button alongside or instead of the icon.

- `shouldShowIcon` (boolean): When `true`, the search icon (magnifying glass) is shown in the button. Set to `false` to show only the label text.

- `buttonWidth` (string): Width of the search button. Accepts any valid CSS size value (e.g. `'120px'`, `'8rem'`).

- `buttonHeight` (string): Height of the search button. Accepts any valid CSS size value (e.g. `'40px'`, `'2.5rem'`).

- `maxWidth` (string): Maximum width of the search button. Useful when the button is inside a fluid container.

- `maxHeight` (string): Maximum height of the search button.

    ```javascript
    var { Placement } = window.InlineAI;

    window.InlineAI.mount(Placement.SearchIcon, 'nav-search', {
      label: 'Search',
      shouldShowIcon: true,
      buttonWidth: '120px',
      buttonHeight: '40px',
    });
    ```

#### Search FAB

    The `SearchFab` placement is a floating action button that is not anchored to a specific container. Use `fabPosition` to control where it appears on the screen.

- `fabPosition.horizontalPosition` (string): Horizontal anchor for the FAB. Accepts `'left'`, `'right'`, or `'center'`. Also available as `FabPosition.Left` / `FabPosition.Right` / `FabPosition.Center`.

- `fabPosition.leftOffset` (string): Distance from the left edge of the viewport. Accepts any valid CSS length (e.g. `'20px'`). Applied when `horizontalPosition` is `'left'` or `'center'`.

- `fabPosition.rightOffset` (string): Distance from the right edge of the viewport. Accepts any valid CSS length. Applied when `horizontalPosition` is `'right'` or `'center'`.

- `fabPosition.bottomOffset` (string): Distance from the bottom edge of the viewport. Accepts any valid CSS length (e.g. `'24px'`).

- `fabPosition.maxWidth` (string): Maximum width of the FAB button.

    ```javascript
    var { Placement, FabPosition } = window.InlineAI;

    window.InlineAI.mount(Placement.SearchFab, undefined, {
      fabPosition: {
        horizontalPosition: FabPosition.Right,
        rightOffset: '20px',
        bottomOffset: '24px',
      },
    });
    ```

    > `SearchFab` and `Widget` are body-level placements; you do not need to pass a target element. Pass `undefined` as the second argument when you want to supply options without a target.

## Overlay breakpoints

Overlay breakpoints let you override the overlay type, backdrop opacity, and open trigger at specific viewport widths. This is useful when you want a modal on desktop and a drawer on mobile. Each entry in `overlayBreakpoints` can specify `minViewportWidth`, `maxViewportWidth`, or both to define the range it applies to. When multiple breakpoints match the current viewport, the most specific one (narrowest range) wins.

- `overlayBreakpoints` (OverlayBreakpointConfig[]): Array of viewport-specific overlay configuration overrides. Each item can include the following fields: Minimum viewport width in pixels for this breakpoint to apply.

- `maxViewportWidth` (number): Maximum viewport width in pixels for this breakpoint to apply.

- `overlayType` (string): Overlay type at this breakpoint. Accepts `'modal'` or `'drawer'`.

- `backdropOpacity` (number): Backdrop opacity at this breakpoint (0–1).

- `openOverlayOn` (string): Open trigger at this breakpoint. Accepts `'onQuerySubmit'` or `'onFocus'`.

```javascript
var { Placement, OverlayType, OpenOverlayOn } = window.InlineAI;

window.InlineAI.mount(Placement.SearchEmbed, 'search-container', {
  overlayType: OverlayType.Modal,
  backdropOpacity: 0.6,
  overlayBreakpoints: [
    {
      minViewportWidth: 768,
      overlayType: OverlayType.Modal,
      backdropOpacity: 0.6,
    },
    {
      maxViewportWidth: 767,
      overlayType: OverlayType.Drawer,
      backdropOpacity: 1.0,
      openOverlayOn: OpenOverlayOn.Focus,
    },
  ],
});
```

> Set top-level `overlayType` and `backdropOpacity` as your defaults, then use `overlayBreakpoints` only to override the values that differ at certain viewport sizes.
