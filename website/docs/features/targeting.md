---
title: Targeting
---

Targeting allows you to pass key-value pairs to your ad server to help with ad selection and optimization. Moli provides several ways to set targeting values that will be sent with your ad requests.

## Overview

Targeting key-values are used by ad servers and demand-side platforms (DSPs) to:

- Match ads to specific audience segments
- Optimize ad performance based on page context
- Enable programmatic buying with specific criteria
- Improve ad relevance and user experience

## Setting Targeting Values

### Global Targeting

Set targeting values that apply to all ad slots on the page:

```ts
// Set targeting before requesting ads
window.moli.setTargeting('key', 'value');
window.moli.setTargeting('category', 'sports');
window.moli.setTargeting('position', 'sidebar');

// Request ads with targeting applied
window.moli.requestAds();
```

### Per-Page Targeting

For single-page applications, set targeting values for each page:

```ts
// Set page-specific targeting
window.moli.setTargeting('page_type', 'article');
window.moli.setTargeting('article_category', 'technology');
window.moli.setTargeting('author', 'john_doe');

// Request ads for the new page
window.moli.requestAds();
```

### Ad Slot Specific Targeting

Set targeting values for specific ad slots:

```ts
const slot: Moli.AdSlot = {
  domId: 'content_1',
  adUnitPath: '/1234/content_1',
  sizes: [[300, 250], [728, 90]],
  position: 'in-page',
  behaviour: { loaded: 'eager' },
  
  // highlight-start
  gpt: {
    targeting: {
      'slot_position': 'content',
      'content_type': 'article'
    }
  }
  // highlight-end
};
```

## Targeting Configuration

### In MoliConfig

You can set default targeting values in your configuration:

```ts
const moliConfig: Moli.MoliConfig = {
  slots: [ /* ... */ ],
  // highlight-start
  gpt: {
    targeting: {
      'site_section': 'news',
      'content_language': 'en'
    }
  }
  // highlight-end
};
```

### Dynamic Targeting

Use functions to set targeting values dynamically:

```ts
const slot: Moli.AdSlot = {
  domId: 'content_1',
  adUnitPath: '/1234/content_1',
  sizes: [[300, 250]],
  position: 'in-page',
  behaviour: { loaded: 'eager' },
  
  // highlight-start
  gpt: {
    targeting: () => ({
      'page_url': window.location.href,
      'user_agent': navigator.userAgent,
      'timestamp': Date.now().toString()
    })
  }
  // highlight-end
};
```

## Common Targeting Keys

### Content Targeting

- `content_category` - Article or page category
- `content_type` - Type of content (article, video, gallery)
- `content_author` - Content author
- `content_tags` - Content tags or keywords

### User Targeting

- `user_type` - User segment (new, returning, premium)
- `user_location` - Geographic location
- `user_device` - Device type (mobile, desktop, tablet)

### Page Targeting

- `page_type` - Page type (home, article, category)
- `page_section` - Site section
- `page_position` - Ad position on page

### Custom Targeting

- `custom_key` - Any custom key-value pair
- `campaign_id` - Campaign identifier
- `experiment_group` - A/B test group

## Best Practices

### Use Descriptive Keys

```ts
// Good
window.moli.setTargeting('article_category', 'technology');

// Avoid
window.moli.setTargeting('cat', 'tech');
```

### Consistent Naming

```ts
// Use consistent naming across your site
window.moli.setTargeting('content_category', 'sports'); // ✅
window.moli.setTargeting('category', 'sports');        // ❌ Inconsistent
```

### Avoid Sensitive Data

```ts
// Don't include personally identifiable information
window.moli.setTargeting('user_id', '12345');          // ❌ Avoid
window.moli.setTargeting('user_segment', 'premium');   // ✅ Safe
```

### Clear Values

```ts
// Use clear, standardized values
window.moli.setTargeting('device_type', 'mobile');     // ✅ Clear
window.moli.setTargeting('device_type', 'm');          // ❌ Unclear
```

## Integration with Prebid

When using Prebid.js, targeting values can be passed to bidders:

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
          params: {
            placementId: 123,
            // highlight-start
            keywords: {
              category: 'sports',
              position: 'content'
            }
            // highlight-end
          }
        }
      ]
    }
  }
};
```

## Debugging Targeting

Use the debugging console to verify targeting values:

```ts
// Enable debugging
localStorage.setItem('moliDebug', 'true');

// Check targeting in browser console
```

## API Reference

### Available Methods

- `setTargeting(key, value)` - Set a targeting key-value pair for all ad slots

For detailed API documentation, see the [MoliTag API reference](/api/types/moliRuntime/namespaces/MoliRuntime/interfaces/MoliTag).

### Example Usage

```ts
// Set targeting
window.moli.setTargeting('category', 'sports');

