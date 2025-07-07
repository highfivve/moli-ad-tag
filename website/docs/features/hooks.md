---
title: Hooks
---

Moli provides a hooks system that allows you to execute custom code at specific points in the ad loading lifecycle. Hooks are useful for setting up dynamic targeting, triggering events, or performing cleanup operations.

## Overview

Hooks help you:

- Execute code before ads are requested
- Execute code after ads have been loaded
- Set up dynamic targeting and labels
- Trigger custom events
- Perform cleanup operations
- Integrate with analytics and tracking systems

## Available Hooks

### beforeRequestAds

The `beforeRequestAds` hook is called before the ad tag starts requesting ads. This is the perfect place to set up dynamic targeting, add labels, or perform any setup that needs to happen before ad requests.

### afterRequestAds

The `afterRequestAds` hook is called after the ad tag has finished requesting ads. This is useful for triggering events, analytics, or any post-ad-loading operations.

## Basic Usage

### Setting Up Hooks

Hooks must be set up before calling `configure()` or `requestAds()`:

```ts
window.moli = window.moli || { que: [] };
window.moli.que.push(function(moliAdTag) {
  // Set up beforeRequestAds hook
  moliAdTag.beforeRequestAds((config) => {
    // This code runs before ads are requested
    console.log('About to request ads with config:', config);
  });

  // Set up afterRequestAds hook
  moliAdTag.afterRequestAds((state) => {
    // This code runs after ads have been requested
    console.log('Ads requested, state:', state);
  });

  // Configure and request ads
  moliAdTag.requestAds();
});
```

### Hook Parameters

#### beforeRequestAds Parameters

```ts
moliAdTag.beforeRequestAds((config, runtimeConfig) => {
  // config: The final MoliConfig that will be used for ad requests
  // runtimeConfig: The current runtime configuration including labels, targeting, etc.
});
```

#### afterRequestAds Parameters

```ts
moliAdTag.afterRequestAds((state) => {
  // state: The final state after ad requests
  // Possible values: 'finished', 'error', 'spa-finished'
});
```

## Common Use Cases

### Dynamic Targeting

Set up dynamic targeting before each ad request:

```ts
moliAdTag.beforeRequestAds((config) => {
  // Add page-specific targeting
  moliAdTag.setTargeting('page_type', getPageType());
  moliAdTag.setTargeting('user_segment', getUserSegment());
  
  // Add dynamic labels
  moliAdTag.addLabel('premium-user');
  moliAdTag.addLabel('mobile-device');
});
```

### Analytics Integration

Trigger analytics events after ads are loaded:

```ts
moliAdTag.afterRequestAds((state) => {
  if (state === 'finished') {
    // Track successful ad load
    analytics.track('ads_loaded', {
      timestamp: Date.now(),
      adSlots: config.slots.length
    });
  } else if (state === 'error') {
    // Track ad load errors
    analytics.track('ads_error', {
      timestamp: Date.now(),
      error: 'ad_load_failed'
    });
  }
});
```

### Lazy Loading Triggers

Set up lazy loading triggers after initial ads are loaded:

```ts
moliAdTag.afterRequestAds((state) => {
  if (state === 'finished') {
    // Trigger lazy loading for additional ad slots
    window.dispatchEvent(new Event('trigger-lazy-ads'));
  }
});
```

### Single Page Application Integration

In SPAs, hooks are called for each page navigation:

```ts
moliAdTag.beforeRequestAds((config) => {
  // Reset targeting for new page
  moliAdTag.setTargeting('page_url', window.location.href);
  moliAdTag.setTargeting('page_title', document.title);
  
  // Add page-specific labels
  if (window.location.pathname.includes('/sports/')) {
    moliAdTag.addLabel('sports-content');
  }
});

moliAdTag.afterRequestAds((state) => {
  if (state === 'spa-finished') {
    // Page navigation completed, trigger page view tracking
    analytics.track('page_view', {
      url: window.location.href,
      title: document.title
    });
  }
});
```

## Multiple Hooks

You can register multiple hooks of the same type:

```ts
// First beforeRequestAds hook
moliAdTag.beforeRequestAds((config) => {
  moliAdTag.setTargeting('user_type', getUserType());
});

// Second beforeRequestAds hook
moliAdTag.beforeRequestAds((config) => {
  moliAdTag.setTargeting('content_category', getContentCategory());
});

// First afterRequestAds hook
moliAdTag.afterRequestAds((state) => {
  console.log('Ads loaded with state:', state);
});

// Second afterRequestAds hook
moliAdTag.afterRequestAds((state) => {
  if (state === 'finished') {
    analytics.track('ads_complete');
  }
});
```

## Error Handling

Hooks have built-in error handling. If a hook throws an error, it won't prevent other hooks from executing:

```ts
moliAdTag.beforeRequestAds((config) => {
  // This error won't prevent other hooks from running
  throw new Error('Something went wrong');
});

moliAdTag.beforeRequestAds((config) => {
  // This hook will still execute
  console.log('This hook runs even if the previous one failed');
});
```

## Hook Timing

### beforeRequestAds Timing

- Called after configuration is complete
- Called before ad requests are made
- DOM is ready at this point
- Perfect for setting up targeting and labels

### afterRequestAds Timing

- Called after all ad requests are complete
- Called regardless of success or failure
- Useful for cleanup and analytics

## State Values

The `afterRequestAds` hook receives different state values:

- **`'finished'`** - All ads loaded successfully (non-SPA mode)
- **`'spa-finished'`** - All ads loaded successfully (SPA mode)
- **`'error'`** - An error occurred during ad loading

## Best Practices

### Hook Registration

Register hooks early in your setup:

```ts
// ✅ Good - Register hooks before configuration
window.moli.que.push(function(moliAdTag) {
  moliAdTag.beforeRequestAds(setupTargeting);
  moliAdTag.afterRequestAds(trackAnalytics);
  moliAdTag.requestAds();
});

// ❌ Avoid - Register hooks after configuration
window.moli.que.push(function(moliAdTag) {
  moliAdTag.requestAds();
  moliAdTag.beforeRequestAds(setupTargeting); // Too late!
});
```

### Hook Functions

Keep hook functions focused and lightweight:

```ts
// ✅ Good - Focused hook functions
const setupTargeting = (config) => {
  moliAdTag.setTargeting('page_type', getPageType());
};

const trackAnalytics = (state) => {
  analytics.track('ads_complete', { state });
};

// ❌ Avoid - Complex logic in hooks
const complexHook = (config) => {
  // Too much logic in one hook
  const userData = fetchUserData();
  const pageData = analyzePage();
  const targeting = calculateTargeting(userData, pageData);
  // ... many more operations
};
```

### Error Handling

Handle errors gracefully in hooks:

```ts
moliAdTag.beforeRequestAds((config) => {
  try {
    const userSegment = getUserSegment();
    moliAdTag.setTargeting('user_segment', userSegment);
  } catch (error) {
    console.warn('Failed to set user segment:', error);
    // Continue with default targeting
  }
});
```

## API Reference

### Available Methods

- `beforeRequestAds(callback)` - Register a hook to run before ad requests
- `afterRequestAds(callback)` - Register a hook to run after ad requests

For detailed API documentation, see the [MoliTag API reference](/api/types/moliRuntime/namespaces/MoliRuntime/interfaces/MoliTag).

### Hook Function Signatures

```ts
// beforeRequestAds callback
type BeforeRequestAdsHook = (
  config: MoliConfig,
  runtimeConfig: MoliRuntimeConfig
) => void;

// afterRequestAds callback
type AfterRequestAdsHook = (
  state: 'finished' | 'error' | 'spa-finished'
) => void;
```

### Configuration Notes

- Hooks must be registered before calling `configure()` or `requestAds()`
- Multiple hooks of the same type are supported
- Hooks are called in the order they were registered
- Errors in hooks don't prevent other hooks from executing
- In SPA mode, hooks are called for each page navigation
