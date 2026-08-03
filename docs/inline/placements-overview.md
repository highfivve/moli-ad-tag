Placements are the individual AI features the Widget SDK renders on your page. Each one has a specific purpose, from a sticky conversational sidebar to in-content question pills, and is rendered either automatically from your dashboard configuration or explicitly with `window.InlineAI.mount()`.

## All placement types

| Placement | Enum value | Description | Target required |
|-----------|------------|-------------|:---------------:|
| Widget | `widget` | Sticky sidebar panel with a floating trigger button | No |
| Search FAB | `search-fab` | Floating action button for search, attaches to the page body | No |
| Search embed | `search-embed` | Full-width search input bar rendered inside a container | Yes |
| Search icon | `search-icon` | Compact icon/button that opens the search overlay | Yes |
| Key takeaways | `key-takeaways` | AI-generated summary block for article content | Yes |
| Single question | `single-question` | In-content question pills distributed across paragraphs | Yes |
| Basic embed | `basic-embed` | Generic AI content block rendered into a container | Yes |

## Body-level vs targeted placements

**Body-level placements** (`Widget` and `SearchFab`) attach directly to `document.body` and need no target element. They're what auto mode renders by default, and they're the fastest path to AI on a page.

**Targeted placements** (everything else) render inside a DOM element you specify. Pass a string element ID, a CSS selector, or a dynamic element matcher.

```javascript
// Body-level: no target needed
window.InlineAI.mount(window.InlineAI.Placement.Widget);
window.InlineAI.mount(window.InlineAI.Placement.SearchFab);

// Targeted: target is required
window.InlineAI.mount(window.InlineAI.Placement.SearchEmbed, 'search-container');
window.InlineAI.mount(window.InlineAI.Placement.KeyTakeaways, { selector: '.article-sidebar' });
```

See [injection targets](/configuration/injection-targets) for the full targeting syntax and [mount options](/configuration/mount-options) for options shared across placement types.

## Placement pages

- [Widget](/placements/widget): Sticky sidebar panel with a floating trigger. The default in auto mode.
- [Search FAB](/placements/search-fab): Floating search button. No target required.
- [Search embed](/placements/search-embed): Full-width search input embedded in a container.
- [Search icon](/placements/search-icon): Compact button that opens the search overlay.
- [Key takeaways](/placements/key-takeaways): AI-generated summary block for articles.
- [Single question](/placements/single-question): In-content question pills distributed across paragraphs.
- [Basic embed](/placements/basic-embed): Generic AI content block for any container.
