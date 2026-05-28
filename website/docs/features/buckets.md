---
title: Ad Slot Buckets
---

Ad slot buckets allow you to group related ad slots together for better management, optimization, and control. Buckets provide a way to organize ad slots by category, position, or any other logical grouping that makes sense for your site.

## Overview

Buckets help you:

- Group related ad slots for easier management
- Apply common configurations to multiple slots
- Optimize ad loading and performance
- Control ad refresh and lifecycle management
- Implement advanced targeting strategies

## How Buckets Work

### Bucket Structure

A bucket is a logical grouping of ad slots that share common characteristics. Each ad slot can be assigned to a bucket either as a simple string or as a device-specific mapping:

```ts
// Simple bucket assignment
const slot: Moli.AdSlot = {
  domId: 'content_1',
  adUnitPath: '/1234/content_1',
  sizes: [[300, 250]],
  position: 'in-page',
  behaviour: { loaded: 'eager' },
  bucket: 'content' // Single bucket for all devices
};

// Device-specific bucket assignment
const slot: Moli.AdSlot = {
  domId: 'content_1',
  adUnitPath: '/1234/content_1',
  sizes: [[300, 250]],
  position: 'in-page',
  behaviour: { loaded: 'eager' },
  bucket: {
    mobile: 'mobile-content',
    desktop: 'desktop-content'
  }
};
```

### Bucket Types

Here are some possible use cases for buckets:

- **Position Buckets** - Group slots by page position (header, content, sidebar)
- **Device Buckets** - Group slots by device type (mobile, desktop)
- **Content Buckets** - Group slots by content type (article, gallery, video)
- **Size Buckets** - Group slots by ad size (banner, rectangle, leaderboard)

You can group toghether slots as you like. We usually recommend as few buckets as possible and by device.

## Basic Configuration

### Enable Buckets

Enable bucket functionality in your Moli configuration:

```ts
const moliConfig: Moli.MoliConfig = {
  slots: [ /* ... */ ],
  // highlight-start
  bucket: {
    enabled: true
  }
  // highlight-end
};
```

### Simple Bucket Assignment

Assign slots to buckets using simple string values:

```ts
const moliConfig: Moli.MoliConfig = {
  slots: [
    {
      domId: 'content_1',
      adUnitPath: '/1234/content_1',
      sizes: [[300, 250]],
      position: 'in-page',
      behaviour: { loaded: 'eager' },
      // highlight-start
      bucket: 'content'
      // highlight-end
    },
    {
      domId: 'content_2',
      adUnitPath: '/1234/content_2',
      sizes: [[300, 250]],
      position: 'in-page',
      behaviour: { loaded: 'eager' },
      // highlight-start
      bucket: 'content'
      // highlight-end
    },
    {
      domId: 'sidebar_1',
      adUnitPath: '/1234/sidebar_1',
      sizes: [[300, 600]],
      position: 'in-page',
      behaviour: { loaded: 'eager' },
      // highlight-start
      bucket: 'sidebar'
      // highlight-end
    }
  ],
  bucket: {
    enabled: true
  }
};
```

### Device-Specific Bucket Assignment

Assign different buckets based on device type:

```ts
const moliConfig: Moli.MoliConfig = {
  slots: [
    {
      domId: 'content_1',
      adUnitPath: '/1234/content_1',
      sizes: [[300, 250]],
      position: 'in-page',
      behaviour: { loaded: 'eager' },
      // highlight-start
      bucket: {
        mobile: 'mobile-content',
        desktop: 'desktop-content'
      }
      // highlight-end
    },
    {
      domId: 'sidebar_1',
      adUnitPath: '/1234/sidebar_1',
      sizes: [[300, 600]],
      position: 'in-page',
      behaviour: { loaded: 'eager' },
      // highlight-start
      bucket: {
        mobile: 'mobile-sidebar',
        desktop: 'desktop-sidebar'
      }
      // highlight-end
    }
  ],
  bucket: {
    enabled: true
  }
};
```

## Advanced Bucket Configuration

### Bucket-Specific Timeouts

Configure different timeouts for different buckets:

```ts
const moliConfig: Moli.MoliConfig = {
  slots: [ /* ... */ ],
  // highlight-start
  bucket: {
    enabled: true,
    bucket: {
      'content': {
        timeout: 2000 // 2 seconds for content bucket
      },
      'sidebar': {
        timeout: 1500 // 1.5 seconds for sidebar bucket
      },
      'mobile-content': {
        timeout: 2500 // 2.5 seconds for mobile content bucket
      }
    }
  }
  // highlight-end
};
```

### Dynamic Bucket Assignment

Assign buckets dynamically based on page context:

```ts
const getBucketAssignment = (slotId: string) => {
  const isMobile = window.innerWidth <= 768;
  const isContent = slotId.includes('content');
  
  if (isContent) {
    return isMobile ? 'mobile-content' : 'desktop-content';
  } else {
    return isMobile ? 'mobile-sidebar' : 'desktop-sidebar';
  }
};

const moliConfig: Moli.MoliConfig = {
  slots: [
    {
      domId: 'content_1',
      adUnitPath: '/1234/content_1',
      sizes: [[300, 250]],
      position: 'in-page',
      behaviour: { loaded: 'eager' },
      // highlight-start
      bucket: getBucketAssignment('content_1')
      // highlight-end
    }
  ],
  bucket: {
    enabled: true
  }
};
```

### Conditional Bucket Configuration

Configure buckets based on conditions:

```ts
const moliConfig: Moli.MoliConfig = {
  slots: [ /* ... */ ],
  bucket: {
    enabled: true,
    // highlight-start
    bucket: {
      'content': {
        timeout: window.innerWidth > 768 ? 2000 : 2500 // Different timeouts for mobile/desktop
      },
      'premium': {
        timeout: 3000 // Longer timeout for premium content
      }
    }
    // highlight-end
  }
};
```

## Bucket Management

### Refresh Bucket

Refresh all slots in a bucket:

```ts
// Refresh all slots in the content bucket
window.moli.refreshBucket('content');

// Refresh device-specific bucket
window.moli.refreshBucket('mobile-content');
```

## Bucket Use Cases

### Bidder Performance Optimization

Some bidders (e.g., IndexExchange, Yieldlab) perform better when requests contain only a small number of placement IDs. Buckets allow you to group ad slots and run them in separate auctions:

```ts
const moliConfig: Moli.MoliConfig = {
  slots: [
    {
      domId: 'content_1',
      adUnitPath: '/1234/content_1',
      sizes: [[300, 250]],
      position: 'in-page',
      behaviour: { loaded: 'eager' },
      bucket: 'content-group-1'
    },
    {
      domId: 'content_2',
      adUnitPath: '/1234/content_2',
      sizes: [[300, 250]],
      position: 'in-page',
      behaviour: { loaded: 'eager' },
      bucket: 'content-group-2'
    }
  ],
  bucket: {
    enabled: true,
    bucket: {
      'content-group-1': {
        timeout: 2000
      },
      'content-group-2': {
        timeout: 2000
      }
    }
  }
};
```

### Above and Below the Fold

Group ad slots with different priorities based on their position on the page:

```ts
const moliConfig: Moli.MoliConfig = {
  slots: [
    {
      domId: 'header_1',
      adUnitPath: '/1234/header_1',
      sizes: [[728, 90]],
      position: 'in-page',
      behaviour: { loaded: 'eager' },
      bucket: 'above-fold'
    },
    {
      domId: 'content_1',
      adUnitPath: '/1234/content_1',
      sizes: [[300, 250]],
      position: 'in-page',
      behaviour: { loaded: 'eager' },
      bucket: 'below-fold'
    }
  ],
  bucket: {
    enabled: true,
    bucket: {
      'above-fold': {
        timeout: 1500 // Faster timeout for above-fold ads
      },
      'below-fold': {
        timeout: 2500 // Slower timeout for below-fold ads
      }
    }
  }
};
```

## Device-Specific Bucket Strategies

### Mobile vs Desktop Layout

Use device-specific buckets to optimize for different layouts:

```ts
const moliConfig: Moli.MoliConfig = {
  slots: [
    {
      domId: 'content_1',
      adUnitPath: '/1234/content_1',
      sizes: [[300, 250]],
      position: 'in-page',
      behaviour: { loaded: 'eager' },
      bucket: {
        mobile: 'mobile-content',
        desktop: 'desktop-content'
      }
    },
    {
      domId: 'sidebar_1',
      adUnitPath: '/1234/sidebar_1',
      sizes: [[300, 600]],
      position: 'in-page',
      behaviour: { loaded: 'eager' },
      bucket: {
        mobile: 'mobile-sidebar',
        desktop: 'desktop-sidebar'
      }
    }
  ],
  bucket: {
    enabled: true,
    bucket: {
      'mobile-content': {
        timeout: 2500 // Longer timeout for mobile content
      },
      'desktop-content': {
        timeout: 2000 // Standard timeout for desktop content
      },
      'mobile-sidebar': {
        timeout: 2000 // Standard timeout for mobile sidebar
      },
      'desktop-sidebar': {
        timeout: 1500 // Faster timeout for desktop sidebar
      }
    }
  }
};
```

### Responsive Design Buckets

Adapt bucket strategies for responsive designs:

```ts
const moliConfig: Moli.MoliConfig = {
  slots: [
    {
      domId: 'banner_1',
      adUnitPath: '/1234/banner_1',
      sizes: [[728, 90], [320, 50]],
      position: 'in-page',
      behaviour: { loaded: 'eager' },
      bucket: {
        mobile: 'mobile-banners',
        tablet: 'tablet-banners',
        desktop: 'desktop-banners'
      }
    }
  ],
  bucket: {
    enabled: true,
    bucket: {
      'mobile-banners': {
        timeout: 2000
      },
      'tablet-banners': {
        timeout: 1800
      },
      'desktop-banners': {
        timeout: 1500
      }
    }
  }
};
```

## Bucket Monitoring

### Debug Console

Use the debug console to monitor bucket behavior:

```ts
// Enable debug mode
localStorage.setItem('moliDebug', 'true');

// Open debug console
window.moli.openConsole();

// Monitor bucket events in the console
```

### Network Monitoring

Monitor bucket requests in browser developer tools:

```ts
// Check network tab for bucket requests
// Look for requests to ad units in the bucket
// Monitor timeout behavior and success rates
```

## Bucket Best Practices

### Logical Grouping

```ts
// ✅ Good - Logical bucket grouping
const slots = [
  {
    domId: 'header_1',
    bucket: 'header'
  },
  {
    domId: 'content_1',
    bucket: 'content'
  },
  {
    domId: 'sidebar_1',
    bucket: 'sidebar'
  }
];

// ❌ Avoid - Arbitrary grouping
const slots = [
  {
    domId: 'header_1',
    bucket: 'group1' // Unclear purpose
  },
  {
    domId: 'content_1',
    bucket: 'group2' // Unclear purpose
  }
];
```

### Device-Specific Naming

```ts
// ✅ Good - Clear device-specific naming
bucket: {
  mobile: 'mobile-content',
  desktop: 'desktop-content'
}

// ❌ Avoid - Unclear device mapping
bucket: {
  mobile: 'bucket1',
  desktop: 'bucket2'
}
```

### Appropriate Timeouts

```ts
// ✅ Good - Reasonable timeouts
bucket: {
  bucket: {
    'content': {
      timeout: 2000 // 2 seconds
    },
    'sidebar': {
      timeout: 1500 // 1.5 seconds
    }
  }
}

// ❌ Avoid - Too aggressive timeouts
bucket: {
  bucket: {
    'content': {
      timeout: 500 // Too short
    }
  }
}
```

### Bucket Size Management

```ts
// ✅ Good - Manageable bucket sizes
// Group 2-4 slots per bucket for optimal performance

// ❌ Avoid - Too many slots in one bucket
// Grouping 10+ slots in a single bucket may impact performance
```

## API Reference

### Available Methods

- `refreshBucket(bucket)` - Refresh all slots in a bucket

For detailed API documentation, see the [MoliTag API reference](/api/types/moliRuntime/namespaces/MoliRuntime/interfaces/MoliTag).

### Configuration Notes

- **enabled**: Enable bucket functionality globally
- **bucket**: Map of bucket names to their specific configurations
- **timeout**: Timeout for prebid/a9 requests in milliseconds
- **AdSlotBucket**: Can be a string (single bucket) or device-specific mapping
- **Device**: Typically 'mobile' or 'desktop' for responsive layouts

Buckets are configured through the configuration objects and can be refreshed using the `refreshBucket` method.
