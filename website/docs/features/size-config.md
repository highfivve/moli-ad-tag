---
title: Size Config
---

The web is responsive and so should your ads be. The size config is allows you to filter sizes based on [media queries]
and [labels]. Size configs are defined in two places

- **global** - the [label size config] configures global [labels]. Usually to separate `desktop` and `mobile` placements.
- **ad slot** - each ad slot has a size config to filter the supported sizes

## Label Size Config

There are various use cases for [labels]. One is to filter out ad units, placements or configurations that should only
be available for a certain [device] layouts. The `labelSizeConfig` property is where you configure those labels.

A minimal configuration for a page with a layout breakpoint between `desktop` and `mobile` at `768px` looks like this.

```ts title="configuration.ts"
import { Moli } from '@highfivve/ad-tag';

const moliConfig: Moli.MoliConfig = {
  slots: [ ... ],
  // highlight-start
  labelSizeConfig: [
    {
      labelsSupported: ['mobile'],
      mediaQuery: '(max-width: 767px)'
    },
    {
      labelsSupported: ['desktop'],
      mediaQuery: '(min-width: 768px)'
    }
  ]
  // highlight-end
}
```

:::tip

The main [device] labels **should not** overlap as they distinguish two different layouts on the page.

:::

You can think of the size config as a continuous scale that you split into labels

```
                               desktop             desktop
                                                   wide screen
          iPhone5   iPad4      iPad4
                    landscape  portrait
             │          │        │                    │
  x──────────┴──────────┴────────┴────────────────────┴─────────────► screen width
  0px      320px     768px     1024px             1920px       < 2000px

  x───────────────────x
                      x─────────────────────────────────────────────►
       mobile                        desktop
```

### Device Layout and Labels

Usually `mobile` and `desktop` are enough as labels for your page. Why not `tablet` you may ask? Depending on how
a user holds the tablet, landscape or portrait, the page may show a mobile or a desktop layout. We have seen websites
simplify their page layouts over the last years into 1-column layouts on mobile and some times even desktop and everything
that's slightly bigger has a 2-column layout.

:::tip

Like your page layout, you shouldn't complicate your ad tag configuration.

:::

Still there are some cases where you need additional labels. The main reason are prebid bidders that don't understand
multi size bids. The recommendation is to create "sub labels" for a device type:

```ts
labelSizeConfig: [
  // ...
  {
    labelsSupported: ['desktop'],
    mediaQuery: '(min-width: 768px)'
  },
  {
    labelsSupported: ['desktop-800'],
    mediaQuery: '(min-width: 860px)'
  },
  {
    labelsSupported: ['desktop-970'],
    mediaQuery: '(min-width: 1030px)'
  }
]
```

This allows you to filter certain bids with `labelAll`

```ts
const bid = {
  bidder: 'bidderA',
  params: { },
  // highlight-next-line
  labelAll: ['desktop', 'desktop-800']
};
```

The ad tag will filter the bid if the label `desktop-800` is not available.


## Ad Slot Size Config

Each ad slot **must** define a size config. An empty arrays means that all sizes are always allowed.
A `SizeConfigEntry` adds the configured `supportedSizes` if the `mediaQuery` and the `labels` property match.
`labels` is optional and should only be used in rare cases, where you have the same ad unit on multiple pages with
different layouts. An extra label for the page can then be used to additionally filter ad units.

```ts
import { Moli } from '@highfivve/ad-tag';

const slot: Moli.AdSlot = {
  domId: 'content_1',
  adUnitPath: '/1234/content_1',
  sizes: [ [300, 250], [728, 90] ],
  position: 'in-page',
  behaviour: { loaded: 'eager'  },

  // highlight-start
  sizeConfig: [
    {
      mediaQuery: '(max-width: 767px)',
      sizesSupported: [[300, 250]]
    },
    {
      mediaQuery: '(min-width: 768px)',
      sizesSupported: [[728, 90]]
    }
  ]
  // highlight-end
};
```


:::tip

Build your size configs from bottom up until the next breakpoint. Each config should only append sizes.
This keeps your size configs small as you don't have to duplicate a lot of sizes and optimizes revenue as there are more
formats to bid on.

:::

```
                ┌───────┐         ┌─────────────────────────────────┐
                │468x60 │         │970x90|970x250                   │
         ┌──────┴───────┤     ┌───┴─────────────────────────────────┤
         │320x50|300x100│     │800x250                              │
  ┌──────┴──────────────┼─────┴─────────────────────────────────────┤
  │300x50|300x75|300x100│728x90                                     │
  └─────────────────────┴───────────────────────────────────────────┘
  x─────────────────────────────────────────────────────────────────►
  0px      320px     768px     1024px             1920px       < 2000px

  x───────────────────x
                      x─────────────────────────────────────────────►
       mobile                        desktop
 ```


[media queries]: https://developer.mozilla.org/en-US/docs/Web/CSS/Media_Queries
[labels]: labels.md
[label size config]: ../api/interfaces/Moli.MoliConfig.md#labelsizeconfig
[device]: ../getting-started/glossary.md
