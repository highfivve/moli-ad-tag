---
title: Inline AI
---

The `inlineAi` module loads the [Inline AI](https://getinline.tech) widget SDK and drives its
placement rendering via the SDK's own command queue (`window.InlineAI.cmd`), gated on TCF
Purpose 1 consent.

- SDK docs: https://docs.getinline.io/introduction
- Placement showcase: https://www.getinline.io/platform/placements

See `docs/adr/0010-inline-ai-placement-mode-scoping-via-labels.md` for why per-placement mode
scoping reuses [labels](./labels.md) instead of a bespoke field.

## Integration modes

`mode` mirrors the three integration modes the InlineAI SDK itself supports:

- **`auto`** — hard bypass. The module only loads the script; it never reads `placements` or
  touches the command queue. The InlineAI dashboard owns all rendering.
- **`programmatic`** — pushes `['init', { publisherId }]`, then a `['mount', ...]` entry for
  every placement whose `labelCondition` matches.
- **`hybrid`** — never pushes `init()` (that would flip the SDK itself into programmatic mode
  and disable its dashboard auto-rendering), but still pushes `['mount', ...]` for every
  matching placement, layering explicit placements on top of the dashboard's auto-rendered ones.

A placement's `labelCondition` is evaluated against the ad pipeline's regular active
[labels](./labels.md). To scope a placement to one mode, set that mode name up as a static
label in the highfivve portal (e.g. `hybrid`) rather than a mode-only field — the module does
not inject a mode label itself.

## Placements

`placements` supports the seven types the InlineAI SDK exposes: `widget`, `search-fab`,
`search-embed`, `search-icon`, `key-takeaways`, `single-question`, `basic-embed`. `widget` and
`search-fab` are body-level with no target; the other five require a `target` (a container id
or an object with injection/breakpoint options). See the
[placement showcase](https://www.getinline.io/platform/placements) for what each type renders.

## Single page applications

On a regular page the module runs once, on ad pipeline init. On a [single page app](./single-page-app.md)
(`spa.enabled` in the moli config) it instead re-runs once per `requestAds()` call, since
placements need to be re-mounted for every new page:

- the first `requestAds()` call queues `['init', ...]`/`['mount', ...]` straight away.
- every later call first queues `['destroy']` to tear down the previous page's placements,
  then re-applies the mode for the new page.

The InlineAI script itself is only ever loaded once, no matter how many pages are visited. No
extra module configuration is needed - this follows automatically from the global `spa` setting.

## Examples

### Auto mode

The InlineAI dashboard controls everything; `placements` is not needed.

```ts
modules: {
  inlineAi: {
    enabled: true,
    publisherId: 'YOUR_PUBLISHER_ID',
    scriptUrl: 'https://getinline.tech/default/assets/index.js',
    mode: 'auto'
  }
}
```

### Programmatic mode

```ts
modules: {
  inlineAi: {
    enabled: true,
    publisherId: 'YOUR_PUBLISHER_ID',
    scriptUrl: 'https://getinline.tech/default/assets/index.js',
    mode: 'programmatic',
    placements: [
      { name: 'sidebar-widget', type: 'widget' },
      {
        name: 'article-search',
        type: 'search-embed',
        target: 'inline-ai-search-box',
        options: { placeholder: 'Ask a question...' }
      }
    ]
  }
}
```

### Hybrid mode with mode-scoped placement

`key-takeaways` only mounts for readers carrying the `hybrid` label, set up as a static label
in the highfivve portal:

```ts
modules: {
  inlineAi: {
    enabled: true,
    publisherId: 'YOUR_PUBLISHER_ID',
    scriptUrl: 'https://getinline.tech/default/assets/index.js',
    mode: 'hybrid',
    placements: [
      {
        name: 'article-takeaways',
        type: 'key-takeaways',
        target: { selector: '.article-sidebar', location: 'prepend', maxWidth: '400px' },
        labelCondition: { labelAll: ['hybrid'] }
      }
    ]
  }
}
```
