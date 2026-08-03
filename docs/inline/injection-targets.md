The `target` parameter in `mount()` tells the SDK which DOM element to inject a placement into. You have three methods to choose from: a plain string shorthand for element IDs, a CSS selector for flexible matching, or dynamic tag-and-attribute rules for when stable IDs and classes aren't available. All three methods can be combined with positioning and sizing options to control exactly how the placement container appears on the page.

## Targeting methods

#### Element ID

    The simplest way to specify a target is to pass the element's `id` attribute as a plain string. The SDK treats any string `target` as a `containerId` lookup; both forms below are equivalent.

    ```javascript
    // String shorthand (most common)
    window.InlineAI.mount(window.InlineAI.Placement.SearchEmbed, 'header-search');

    // Explicit containerId object, identical behavior
    window.InlineAI.mount(window.InlineAI.Placement.SearchEmbed, { containerId: 'header-search' });
    ```

    ```html
    <div id="header-search"></div>
    ```

    > Use the string shorthand when you have a stable, unique element ID. It is the most concise option and is equivalent to passing `{ containerId: 'id' }`.

#### CSS selector

    Pass any valid CSS selector via the `selector` field when you need to target an element without a unique ID, or when you want to match based on class, attribute, or DOM structure.

    ```javascript
    var { Placement } = window.InlineAI;

    // Class selector
    window.InlineAI.mount(Placement.KeyTakeaways, { selector: '.article-sidebar' });

    // Attribute selector
    window.InlineAI.mount(Placement.SearchEmbed, { selector: '[data-role="search"]' });

    // Structural selector
    window.InlineAI.mount(Placement.BasicEmbed, { selector: 'main > aside:first-child' });
    ```

    > When a selector matches more than one element, the SDK injects into the first match unless you combine it with `injectionLimit` or `injectionStrategy`.

#### Dynamic matching

    Dynamic matching lets you specify a target by tag name plus an optional attribute name and value. This is useful for pages where element IDs and class names are generated dynamically or change between deploys.

    ```javascript
    window.InlineAI.mount(window.InlineAI.Placement.BasicEmbed, {
      dynamic: {
        tagName: 'div',
        attributeName: 'class',
        attributeValue: 'content-area',
        elementIndex: 0,
      },
    });
    ```

    The `dynamic` object accepts the following fields:

- `dynamic.tagName` (string): The HTML tag name to search for (e.g. `'div'`, `'article'`, `'section'`). This is the only required field.

- `dynamic.attributeName` (string): The name of the attribute to match against (e.g. `'class'`, `'data-section'`). Omit to match any element with the given tag name.

- `dynamic.attributeValue` (string): The expected value of `attributeName`. Required when `attributeName` is set. The match is exact (not a substring match).

- `dynamic.elementIndex` (number): Selects the Nth element from all matches (0-indexed). Defaults to `0` (first match). Use this when multiple elements share the same tag and attribute.

## Positioning with `location`

By default, the SDK appends the placement container as a child of the target element. You can change this with the `location` field using the `InjectionLocation` enum.

```javascript
var { Placement, InjectionLocation } = window.InlineAI;

window.InlineAI.mount(Placement.KeyTakeaways, {
  selector: '.sidebar',
  location: InjectionLocation.Prepend,
});
```

| Value | Behavior |
|---|---|
| `InjectionLocation.Above` | Insert as a sibling immediately before the target element |
| `InjectionLocation.Below` | Insert as a sibling immediately after the target element |
| `InjectionLocation.Prepend` | Insert as the first child inside the target element |
| `InjectionLocation.Append` | Insert as the last child inside the target element (default) |

You can also use the raw string values (`'above'`, `'below'`, `'prepend'`, `'append'`) in place of the enum.

## Sizing the placement container

Control the dimensions of the injected container with `width`, `height`, `maxWidth`, and `maxHeight`. These accept any valid CSS size value.

```javascript
window.InlineAI.mount(window.InlineAI.Placement.BasicEmbed, {
  selector: '.sidebar',
  width: '100%',
  maxWidth: '600px',
  height: 'auto',
  maxHeight: '400px',
});
```

> Sizing fields on the injection target control the placement **container** element. To size the placement contents themselves, see the width and height options available on individual placement types.

## Full example

The example below combines all three targeting approaches with positioning:

```javascript
var { Placement, InjectionLocation } = window.InlineAI;

// Element ID: search bar in the header
window.InlineAI.mount(Placement.SearchEmbed, 'header-search');

// CSS selector: key takeaways above the sidebar
window.InlineAI.mount(Placement.KeyTakeaways, {
  selector: '.article-sidebar',
  location: InjectionLocation.Prepend,
});

// Dynamic matching: first div with class "content-area"
window.InlineAI.mount(Placement.BasicEmbed, {
  dynamic: {
    tagName: 'div',
    attributeName: 'class',
    attributeValue: 'content-area',
    elementIndex: 0,
  },
});
```
