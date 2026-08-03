Breakpoints let you adapt placement rendering to the current viewport width. The SDK supports two independent breakpoint systems: placement breakpoints, which control whether and at what size a placement container renders, and overlay breakpoints, which override how the search overlay behaves on different screen sizes. You can use either or both systems independently.

## Placement breakpoints

Placement breakpoints are defined in the `breakpoints` array on the injection target (the second argument to `mount()`). Each entry specifies a viewport range and the `width` and `height` the container should use within that range. The placement only renders when at least one breakpoint matches the current viewport width.

> If you define `breakpoints` and no entry matches the current viewport, the placement will not render at all. Make sure your breakpoints cover all the viewport widths you want the placement to appear on.

- `breakpoints` (BreakpointConfig[]): Array of viewport-specific sizing rules. Each item can include the following fields: Minimum viewport width in pixels for this breakpoint to apply. Omit to match all widths up to `maxViewportWidth`.

- `maxViewportWidth` (number): Maximum viewport width in pixels for this breakpoint to apply. Omit to match all widths from `minViewportWidth` upward.

- `width` (string): Width of the placement container at this breakpoint. Accepts any valid CSS size value (e.g. `'100%'`, `'320px'`).

- `height` (string): Height of the placement container at this breakpoint. Accepts any valid CSS size value (e.g. `'48px'`, `'auto'`).

```javascript
// Placement only renders on viewports ≥768px at 48px tall,
// or on viewports ≤767px at 40px tall.
window.InlineAI.mount(window.InlineAI.Placement.SearchEmbed, {
  containerId: 'search-area',
  breakpoints: [
    { minViewportWidth: 768, width: '100%', height: '48px' },
    { maxViewportWidth: 767, width: '100%', height: '40px' },
  ],
});
```

You can also use `minViewportWidth` and `maxViewportWidth` together to target a specific range:

```javascript
// Only render on tablets (768px–1023px)
window.InlineAI.mount(window.InlineAI.Placement.KeyTakeaways, {
  selector: '.article-sidebar',
  breakpoints: [
    { minViewportWidth: 768, maxViewportWidth: 1023, width: '280px', height: 'auto' },
  ],
});
```

## Overlay breakpoints

Overlay breakpoints are part of `MountOptions` (the third argument to `mount()`). They override the search overlay's type, backdrop opacity, and open trigger at specific viewport widths. You would typically use a modal on wider screens and a drawer on narrower ones.

When multiple overlay breakpoints match the current viewport, the most specific one (the breakpoint with the narrowest defined range) wins.

- `overlayBreakpoints` (OverlayBreakpointConfig[]): Array of viewport-specific overlay configuration overrides. Each item can include the following fields: Minimum viewport width in pixels for this breakpoint to apply.

- `maxViewportWidth` (number): Maximum viewport width in pixels for this breakpoint to apply.

- `overlayType` (string): Overlay type at this breakpoint. Accepts `'modal'` or `'drawer'`.

- `backdropOpacity` (number): Backdrop opacity at this breakpoint. Accepts a value between `0` and `1`.

- `openOverlayOn` (string): When to open the overlay at this breakpoint. Accepts `'onQuerySubmit'` or `'onFocus'`.

```javascript
// Modal on desktop, drawer on mobile, with different open triggers too
window.InlineAI.mount(window.InlineAI.Placement.SearchEmbed, 'search-container', {
  overlayBreakpoints: [
    { minViewportWidth: 768, overlayType: 'modal', backdropOpacity: 0.6 },
    { maxViewportWidth: 767, overlayType: 'drawer', openOverlayOn: 'onFocus' },
  ],
});
```

## Combining both breakpoint types

You can use placement breakpoints and overlay breakpoints together on the same `mount()` call. They are evaluated independently. Placement breakpoints control whether and how large the container renders; overlay breakpoints control how the search results appear when the user interacts with it.

```javascript
var { Placement, OverlayType, OpenOverlayOn } = window.InlineAI;

window.InlineAI.mount(Placement.SearchEmbed, {
  containerId: 'search-area',
  breakpoints: [
    { minViewportWidth: 768, width: '100%', height: '48px' },
    { maxViewportWidth: 767, width: '100%', height: '40px' },
  ],
}, {
  overlayType: OverlayType.Modal,
  overlayBreakpoints: [
    { minViewportWidth: 768, overlayType: OverlayType.Modal, backdropOpacity: 0.6 },
    { maxViewportWidth: 767, overlayType: OverlayType.Drawer, openOverlayOn: OpenOverlayOn.Focus },
  ],
});
```

> Define placement breakpoints in pairs that cover the full range of viewports you care about. Gaps between breakpoints mean the placement will not render in that range.

## FAB visibility breakpoints (publisher-configured)

The Floating Action Button (the trigger that opens the widget) supports **visibility breakpoints** that control which viewport widths it appears on — for example, to hide it on mobile for some sites. Unlike the `mount()` breakpoints above, these are configured **per publisher in the admin dashboard** (Design → the Floating Action Button placement), not through the embed script.

Each breakpoint is a viewport range with an optional `minViewportWidth` and/or `maxViewportWidth` (inclusive, in pixels). The FAB is shown when the current viewport matches **at least one** configured range.

> Visibility breakpoints control visibility only — they do not resize the FAB. If you configure one or more breakpoints and none match the current viewport, the FAB is hidden.

- `visibilityBreakpoints` (VisibilityBreakpointConfig[]): Array of viewport ranges in which the FAB is shown. **Empty or unset means the FAB is shown at all viewport widths** (the default, backwards compatible). Each item can include: Inclusive minimum viewport width in pixels. Omit to match all widths up to `maxViewportWidth`.

- `maxViewportWidth` (number): Inclusive maximum viewport width in pixels. Omit to match all widths from `minViewportWidth` upward.

Common configurations:

- **Hide on mobile** — one breakpoint `{ minViewportWidth: 768 }` shows the FAB only on viewports ≥768px.
- **Desktop only** — `{ minViewportWidth: 1024 }`.
- **Mobile only** — `{ maxViewportWidth: 767 }`.
- **Everywhere (default)** — leave the breakpoints list empty.
