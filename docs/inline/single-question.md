The single question placement injects AI-generated question pills directly into your article content, distributing them across paragraphs as users scroll. Each pill presents a question related to the surrounding content; clicking it opens the search overlay with that question pre-filled. This placement is designed for long-form articles and blog posts where you want to prompt reader engagement at natural breakpoints in the text.

## Mounting the placement

Pass `Placement.SingleQuestion` and a target to `mount()`. The target is typically a dynamic matcher pointing at your article container, since the SDK needs to traverse its child paragraphs to distribute pills.

```javascript
window.InlineAI.mount(
  window.InlineAI.Placement.SingleQuestion,
  {
    dynamic: { tagName: 'article' },
    injectionLimit: 3,
    injectionStrategy: window.InlineAI.InjectionStrategy.DistributeEvenly,
  }
);
```

The call returns a placement ID you can pass to `unmount()`.

> The single question placement requires a target. The SDK injects pills as siblings to paragraph elements inside the target container. For best results, target the element that directly wraps your article body text.

## Mounting from the command queue

To mount from your page markup rather than after the script has loaded, push the command onto the [command queue](/guides/command-queue). Entries are buffered and replayed in order once the SDK is ready.

```html
<script>
  window.InlineAI = window.InlineAI || {};
  window.InlineAI.cmd = window.InlineAI.cmd || [];

  // init() activates programmatic mode
  window.InlineAI.cmd.push(['init', { publisherId: 'YOUR_PUBLISHER_ID' }]);

  window.InlineAI.cmd.push(['mount', 'single-question', {
    dynamic: { tagName: 'article' },
    injectionLimit: 3,
    injectionStrategy: 'distribute-evenly',
  }]);
</script>
```

Place that block **before** the embed snippet.

> Pass the string values here (`'single-question'`, `'distribute-evenly'`) rather than `window.InlineAI.Placement.SingleQuestion` and `window.InlineAI.InjectionStrategy.DistributeEvenly`. The enums are installed by the script itself, so they are not available to code that runs before it. See [enums and the command queue](/guides/command-queue#enums-and-the-command-queue).

## Targeting the container

```javascript Dynamic tag matching
window.InlineAI.mount(window.InlineAI.Placement.SingleQuestion, {
  dynamic: { tagName: 'article' },
  injectionLimit: 3,
  injectionStrategy: window.InlineAI.InjectionStrategy.DistributeEvenly,
});
```

```javascript By element ID
window.InlineAI.mount(window.InlineAI.Placement.SingleQuestion, 'article-body');
```

```javascript By CSS selector
window.InlineAI.mount(window.InlineAI.Placement.SingleQuestion, {
  selector: '.post-content',
  injectionLimit: 5,
});
```

## Injection options

- `injectionLimit` (number): Maximum number of question pills to inject into the content. The SDK will not exceed this number regardless of how many paragraphs the article contains.

- `injectionStrategy` (InjectionStrategy): How to distribute pills across the content: - `window.InlineAI.InjectionStrategy.Default` (`"default"`): places pills at the beginning of the content. - `window.InlineAI.InjectionStrategy.DistributeEvenly` (`"distribute-evenly"`): spaces pills evenly across the available paragraphs.

- `injectionSelectorOffset` (number): Offset for the first injection point. A value of `1` skips the first paragraph and starts injecting from the second.

- `typographySource` (TypographySource): Typography inheritance mode for the question pills: `"inherit-from-website"` or `"inherit-from-theme"`.

## Sizing and positioning

- `location` (InjectionLocation): Where to inject each pill relative to its target paragraph: `"above"`, `"below"`, `"prepend"`, or `"append"`.

- `width` (string): Width of each pill container as a CSS value.

- `maxWidth` (string): Maximum width of each pill container.

- `breakpoints` (BreakpointConfig[]): Responsive breakpoints for controlling when and at what size pills render.

## Examples

```javascript Evenly distributed, limited to 3
window.InlineAI.mount(window.InlineAI.Placement.SingleQuestion, {
  dynamic: { tagName: 'article' },
  injectionLimit: 3,
  injectionStrategy: window.InlineAI.InjectionStrategy.DistributeEvenly,
});
```

```javascript Skip the first paragraph
window.InlineAI.mount(window.InlineAI.Placement.SingleQuestion, {
  selector: '.post-body',
  injectionLimit: 4,
  injectionStrategy: window.InlineAI.InjectionStrategy.DistributeEvenly,
  injectionSelectorOffset: 1,
});
```

```javascript Default strategy
window.InlineAI.mount(window.InlineAI.Placement.SingleQuestion, {
  dynamic: { tagName: 'article' },
  injectionLimit: 2,
  injectionStrategy: window.InlineAI.InjectionStrategy.Default,
});
```

> `InjectionStrategy.DistributeEvenly` tends to produce the best engagement on long articles because it surfaces questions throughout the content rather than clustering them at the top.

For unmounting and SPA routing patterns, see the [programmatic control guide](/guides/programmatic-control).
