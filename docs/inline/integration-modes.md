All three modes use the same embed snippet. The mode is determined by what (if anything) you push into `window.InlineAI.cmd` before the script loads.

## Auto mode

The default. The SDK reads your dashboard configuration and renders placements automatically. You write no JavaScript.

**Pick auto mode when:**

- You want the fastest setup.
- You're happy managing placements from the dashboard.
- You don't need to react to SDK events from your page code.

```html
<script>
  (function(d) {
    var s = d.createElement('script');
    s.type = 'module';
    s.src = 'https://getinline.tech/default/assets/index.js?key=YOUR_PUBLISHER_ID';
    (d.getElementsByTagName('head')[0] || d.getElementsByTagName('body')[0]).appendChild(s);
  })(window.top.document);
</script>
```

That's the entire integration.

## Programmatic mode

Programmatic mode activates when you push an `['init', ...]` command into the queue before the SDK loads (or call `window.InlineAI.init()` directly after it loads). In this mode the SDK does **not** auto-render from your dashboard; you call `mount()` for every placement yourself.

**Pick programmatic mode when:**

- You need precise control over which placements render and where.
- You're building a single-page app whose DOM changes after load.
- You want to integrate placement lifecycle with your own application state.

```html
<div id="search-box"></div>
<div id="article-sidebar"></div>

<script>
  window.InlineAI = window.InlineAI || {};
  window.InlineAI.cmd = window.InlineAI.cmd || [];

  // init() activates programmatic mode
  window.InlineAI.cmd.push(['init', { publisherId: 'YOUR_PUBLISHER_ID' }]);

  window.InlineAI.cmd.push(['mount', 'search-embed', 'search-box', {
    placeholder: 'Ask a question...',
  }]);
  window.InlineAI.cmd.push(['mount', 'key-takeaways', 'article-sidebar']);
  window.InlineAI.cmd.push(['mount', 'widget']);
</script>
```

> Queue commands that run before the script loads take the placement **string values** (`'search-embed'`, `'widget'`). The `window.InlineAI.Placement` enums are installed by the script itself, so they are not available yet at this point. See [enums and the command queue](/guides/command-queue#enums-and-the-command-queue).

Then paste the embed snippet **after** the queue setup:

```html
<script>
  (function(d) {
    var s = d.createElement('script');
    s.type = 'module';
    s.src = 'https://getinline.tech/default/assets/index.js?key=YOUR_PUBLISHER_ID';
    (d.getElementsByTagName('head')[0] || d.getElementsByTagName('body')[0]).appendChild(s);
  })(window.top.document);
</script>
```

For runtime mount/unmount patterns (SPA routing, dynamic content), see the [programmatic control guide](/guides/programmatic-control).

## Hybrid mode

Hybrid mode combines auto rendering with direct SDK access. Placements render from your dashboard just like auto mode, but you can subscribe to events and call `open()` / `close()` from your own code.

Activate hybrid mode by pushing a **function callback** into the queue, without calling `init()`. The SDK passes itself as the first argument when it's ready.

**Pick hybrid mode when:**

- You want auto rendering but need to forward Inline AI events to your own analytics.
- You want to open the search overlay from your own nav button or keyboard shortcut.

```html
<script>
  window.InlineAI = window.InlineAI || {};
  window.InlineAI.cmd = window.InlineAI.cmd || [];

  // Function callback. Do NOT call init() here
  window.InlineAI.cmd.push(function(sdk) {
    sdk.on(sdk.Events.SearchOpen, function(data) {
      analytics.track('inline_search_opened', { query: data.query });
    });

    sdk.on(sdk.Events.WidgetOpen, function() {
      console.log('Widget opened');
    });
  });
</script>
```

Then the embed snippet:

```html
<script>
  (function(d) {
    var s = d.createElement('script');
    s.type = 'module';
    s.src = 'https://getinline.tech/default/assets/index.js?key=YOUR_PUBLISHER_ID';
    (d.getElementsByTagName('head')[0] || d.getElementsByTagName('body')[0]).appendChild(s);
  })(window.top.document);
</script>
```

> Do not call `init()` in hybrid mode. If `init()` is present in the command queue, the SDK switches to programmatic mode and stops auto-rendering placements.

## At a glance

| Feature | Auto | Programmatic | Hybrid |
| --- | :-: | :-: | :-: |
| Auto-renders from dashboard config | Yes | No | Yes |
| JavaScript required | No | Yes | Yes |
| Call `init()` | No | Yes | No |
| Call `mount()` for placements | No | Yes | No |
| Access SDK events (`on()`) | No | Yes | Yes |
| Open/close overlays programmatically | No | Yes | Yes |
| Inspect mounted placements (`getPlacements()`) | No | Yes | Yes |

## Next steps

- [Command queue](/guides/command-queue): How the queue buffers calls made before the script loads.

- [Programmatic control](/guides/programmatic-control): Mount/unmount patterns, SPA routing, overlay control.

- [Events reference](/events/reference): Every event the SDK emits, with payload shapes.

- [Placement types](/placements/overview): The seven AI features you can render.
