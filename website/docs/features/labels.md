---
title: Labels
---

Labels are generic identifiers that can be assigned to various entities in your ad tag configuration. They provide a flexible way to filter ad slots, prebid bids, and size configurations based on specific criteria.

## Overview

Labels allow you to:

- Filter ad slots based on page context or user characteristics
- Control which bidders participate in auctions
- Apply different size configurations based on conditions
- Create conditional ad configurations

## How Labels Work

### Label Assignment

Labels can be assigned to:

- **Ad slots** - Filter which slots are active
- **Prebid bids** - Control bidder participation
- **Size configurations** - Apply different sizes based on conditions

### Label Evaluation

Labels are evaluated against:

- **Media queries** - Screen size and device characteristics
- **Page context** - URL, content type, user state
- **Custom conditions** - Any JavaScript expression

## Basic Usage

### Setting Labels

Set labels that will be available for filtering:

```ts
// Set labels before requesting ads
window.moli.addLabel('mobile');
window.moli.addLabel('premium-user');
window.moli.addLabel('sports-content');

// Request ads with labels applied
window.moli.requestAds();
```

### Label Size Configuration

Configure which sizes are available based on labels:

```ts
const moliConfig: Moli.MoliConfig = {
  slots: [ /* ... */ ],
  // highlight-start
  labelSizeConfig: [
    {
      labelsSupported: ['mobile'],
      mediaQuery: '(max-width: 767px)'
    },
    {
      labelsSupported: ['desktop'],
      mediaQuery: '(min-width: 768px)'
    },
    {
      labelsSupported: ['premium-user'],
      // No media query - label only
    }
  ]
  // highlight-end
};
```

## Ad Slot Filtering

### Filter Ad Slots with Labels

```ts
const slot: Moli.AdSlot = {
  domId: 'content_1',
  adUnitPath: '/1234/content_1',
  sizes: [[300, 250], [728, 90]],
  position: 'in-page',
  behaviour: { loaded: 'eager' },
  
  // highlight-start
  // Only show this slot on mobile devices
  labelAll: ['mobile']
  // highlight-end
};
```

### Multiple Label Conditions

```ts
const slot: Moli.AdSlot = {
  domId: 'premium_1',
  adUnitPath: '/1234/premium_1',
  sizes: [[300, 250]],
  position: 'in-page',
  behaviour: { loaded: 'eager' },
  
  // highlight-start
  // Show only for premium users on desktop
  labelAll: ['premium-user', 'desktop']
  // highlight-end
};
```

### OR Conditions

```ts
const slot: Moli.AdSlot = {
  domId: 'sidebar_1',
  adUnitPath: '/1234/sidebar_1',
  sizes: [[300, 250]],
  position: 'in-page',
  behaviour: { loaded: 'eager' },
  
  // highlight-start
  // Show for either mobile or tablet
  labelAny: ['mobile', 'tablet']
  // highlight-end
};
```

## Prebid Integration

### Filter Bidders with Labels

```ts
const slot: Moli.AdSlot = {
  domId: 'content_1',
  adUnitPath: '/1234/content_1',
  sizes: [[300, 250]],
  position: 'in-page',
  behaviour: { loaded: 'eager' },
  
  prebid: {
    adUnit: {
      mediaTypes: {
        banner: { sizes: [[300, 250]] }
      },
      bids: [
        {
          bidder: 'appNexus',
          params: { placementId: 123 },
          // highlight-start
          // Only bid on mobile devices
          labelAll: ['mobile']
          // highlight-end
        },
        {
          bidder: 'criteo',
          params: { networkId: 456 },
          // highlight-start
          // Only bid for premium users
          labelAll: ['premium-user']
          // highlight-end
        }
      ]
    }
  }
};
```

### Conditional Bidding

```ts
const slot: Moli.AdSlot = {
  domId: 'content_1',
  adUnitPath: '/1234/content_1',
  sizes: [[300, 250]],
  position: 'in-page',
  behaviour: { loaded: 'eager' },
  
  prebid: {
    adUnit: {
      mediaTypes: {
        banner: { sizes: [[300, 250]] }
      },
      bids: [
        {
          bidder: 'rubicon',
          params: { accountId: 789 },
          // highlight-start
          // Bid on either sports or news content
          labelAny: ['sports-content', 'news-content']
          // highlight-end
        }
      ]
    }
  }
};
```

## Size Configuration with Labels

### Responsive Labels

While media queries are usually sufficient you can combine labels and media queries for additional responsives.

```ts
const slot: Moli.AdSlot = {
  domId: 'content_1',
  adUnitPath: '/1234/content_1',
  sizes: [[300, 250], [728, 90], [970, 250]],
  position: 'in-page',
  behaviour: { loaded: 'eager' },
  
  // highlight-start
  sizeConfig: [
    {
      mediaQuery: '(max-width: 767px)',
      sizesSupported: [[300, 250]],
      labels: ['mobile']
    },
    {
      mediaQuery: '(min-width: 768px) and (max-width: 1023px)',
      sizesSupported: [[728, 90]],
      labels: ['tablet']
    },
    {
      mediaQuery: '(min-width: 1024px)',
      sizesSupported: [[970, 250]],
      labels: ['desktop']
    }
  ]
  // highlight-end
};
```

### Content-Based Sizing

```ts
const slot: Moli.AdSlot = {
  domId: 'content_1',
  adUnitPath: '/1234/content_1',
  sizes: [[300, 250], [728, 90]],
  position: 'in-page',
  behaviour: { loaded: 'eager' },
  
  // highlight-start
  sizeConfig: [
    {
      mediaQuery: '(min-width: 768px)',
      sizesSupported: [[728, 90]],
      labels: ['article-content']
    },
    {
      mediaQuery: '(min-width: 768px)',
      sizesSupported: [[300, 250]],
      labels: ['gallery-content']
    }
  ]
  // highlight-end
};
```

## Dynamic Labels

### Page-Based Labels

```ts
// Set labels based on page content
function setPageLabels() {
  const url = window.location.pathname;
  
  if (url.includes('/sports/')) {
    window.moli.addLabel('sports-content');
  } else if (url.includes('/news/')) {
    window.moli.addLabel('news-content');
  }
  
  if (url.includes('/premium/')) {
    window.moli.addLabel('premium-content');
  }
}

// Set labels before requesting ads
setPageLabels();
window.moli.requestAds();
```

### User-Based Labels

```ts
// Set labels based on user characteristics
function setUserLabels() {
  // Check if user is logged in
  if (window.user && window.user.isPremium) {
    window.moli.addLabel('premium-user');
  }
  
  // Check user location
  if (window.user && window.user.country === 'US') {
    window.moli.addLabel('us-user');
  }
  
  // Check device type
  if (window.innerWidth <= 767) {
    window.moli.addLabel('mobile');
  } else {
    window.moli.addLabel('desktop');
  }
}

setUserLabels();
window.moli.requestAds();
```

## Common Label Patterns

### Device Labels

```ts
// Mobile devices
window.moli.addLabel('mobile');

// Desktop devices
window.moli.addLabel('desktop');

// Tablet devices
window.moli.addLabel('tablet');
```

### Content Labels

```ts
// Content categories
window.moli.addLabel('sports-content');
window.moli.addLabel('news-content');
window.moli.addLabel('entertainment-content');

// Content types
window.moli.addLabel('article');
window.moli.addLabel('video');
window.moli.addLabel('gallery');
```

### User Labels

```ts
// User segments
window.moli.addLabel('new-user');
window.moli.addLabel('returning-user');
window.moli.addLabel('premium-user');

// Geographic labels
window.moli.addLabel('us-user');
window.moli.addLabel('eu-user');
```

## Best Practices

### Use Descriptive Names

```ts
// ✅ Good - Clear and descriptive
window.moli.addLabel('mobile-device');
window.moli.addLabel('premium-subscriber');

// ❌ Avoid - Unclear abbreviations
window.moli.addLabel('mob');
window.moli.addLabel('prem');
```

### Consistent Naming

```ts
// Use consistent naming across your site
window.moli.addLabel('mobile');     // ✅ Consistent
window.moli.addLabel('desktop');    // ✅ Consistent
window.moli.addLabel('tablet');     // ✅ Consistent

// Avoid mixing styles
window.moli.addLabel('mobile');     // ❌ Inconsistent
window.moli.addLabel('DESKTOP');    // ❌ Inconsistent
```

### Logical Grouping

```ts
// Group related labels
window.moli.addLabel('device-mobile');
window.moli.addLabel('device-desktop');
window.moli.addLabel('device-tablet');

window.moli.addLabel('content-sports');
window.moli.addLabel('content-news');
window.moli.addLabel('content-entertainment');
```

## API Reference

### Available Methods

- `addLabel(label)` - Add a label that will be available for filtering

For detailed API documentation, see the [MoliTag API reference](/api/types/moliRuntime/namespaces/MoliRuntime/interfaces/MoliTag).

### Example Usage

```ts
// Add labels
window.moli.addLabel('mobile');
window.moli.addLabel('premium-user');
