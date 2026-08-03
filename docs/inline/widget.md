The **Widget** placement is a sticky, conversational AI panel with a floating trigger button. Readers click the trigger to open a sidebar and ask questions scoped to the page content. It's a body-level placement, so it attaches directly to `document.body` and needs no target. The Widget is the default placement in [auto mode](/integration-modes#auto-mode). If you've pasted the embed snippet, this is the AI feature that appears on your site.

## Mounting programmatically

In [programmatic mode](/integration-modes#programmatic-mode), a single `mount()` call is all it takes: no target, no required options.

```javascript
window.InlineAI.mount(window.InlineAI.Placement.Widget);
```

The call returns a placement ID you can pass to `unmount()` later. See the [programmatic control guide](/guides/programmatic-control) for mount/unmount patterns and SPA routing.

## Mounting from the command queue

The call above assumes the Inline AI script has already loaded. To mount the Widget from your page markup instead, push the command onto the [command queue](/guides/command-queue). Entries are buffered and replayed in order once the SDK is ready.

```html
<script>
  window.InlineAI = window.InlineAI || {};
  window.InlineAI.cmd = window.InlineAI.cmd || [];

  // init() activates programmatic mode
  window.InlineAI.cmd.push(['init', { publisherId: 'YOUR_PUBLISHER_ID' }]);

  window.InlineAI.cmd.push(['mount', 'widget']);
</script>
```

Place that block **before** the embed snippet. Like the [search FAB](/placements/search-fab), the Widget is body-level, so no container element is required.

> Pass the placement as the string `'widget'` here rather than `window.InlineAI.Placement.Widget`. The enums are installed by the script itself, so they are not available to code that runs before it. See [enums and the command queue](/guides/command-queue#enums-and-the-command-queue).

## Opening and closing from your own code

Use `window.InlineAI.open()` and `window.InlineAI.close()` with `OverlayTarget.Widget` to drive the sidebar from your own UI, for example a CTA button or a keyboard shortcut.

```javascript
// Open the sidebar
window.InlineAI.open(window.InlineAI.OverlayTarget.Widget);

// Close it
window.InlineAI.close(window.InlineAI.OverlayTarget.Widget);
```

```javascript
document.getElementById('open-assistant').addEventListener('click', function () {
  window.InlineAI.open(window.InlineAI.OverlayTarget.Widget);
});
```

> If you're driving the Widget from your own button, you may want to hide the default floating trigger. Toggle the trigger visibility from your Inline AI dashboard.

## Hiding the floating trigger on some viewports

You can restrict the floating trigger button to specific viewport widths — for example, to hide it on mobile — by configuring **visibility breakpoints** on the Floating Action Button placement in your Inline AI dashboard. With no breakpoints set, the trigger appears at all widths. See [FAB visibility breakpoints](/configuration/breakpoints#fab-visibility-breakpoints-publisher-configured) for details.

## Events

The SDK emits `WidgetOpen` and `WidgetClose` when the sidebar opens and closes. Use them to sync your own UI state, for example to pause a video when the panel opens.

```javascript
var { Events } = window.InlineAI;

window.InlineAI.on(Events.WidgetOpen, function () {
  console.log('Widget panel opened');
});

window.InlineAI.on(Events.WidgetClose, function () {
  console.log('Widget panel closed');
});
```

See the [events reference](/events/reference#widget-events) for payload shapes and the full event catalog.
