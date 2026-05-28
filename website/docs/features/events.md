---
title: Events
---

Moli provides an event system that allows you to listen to important events during the ad loading lifecycle. This system enables you to react to ad request events, track performance, and integrate with external systems.

## Overview

The event system helps you:

- Monitor ad request lifecycle events
- Track performance and timing
- Integrate with analytics systems
- React to ad loading states
- Debug ad loading issues
- Correlate page views with ad requests

## Available Events

### beforeRequestAds

Fired before ads are requested. This event provides access to the runtime configuration that will be used for the ad requests.

**Event Data:**

```ts
{
  runtimeConfig: MoliRuntimeConfig
}
```

### afterRequestAds

Fired after ads have been requested and the ad tag has reached a final state.

**Event Data:**

```ts
{
  state: 'finished' | 'error' | 'spa-finished'
}
```

## Basic Usage

### Adding Event Listeners

You can add event listeners using the `addEventListener` method:

```ts
window.moli = window.moli || { que: [] };
window.moli.que.push(function(moliAdTag) {
  // Listen to beforeRequestAds events
  moliAdTag.addEventListener('beforeRequestAds', (event) => {
    console.log('About to request ads with config:', event.runtimeConfig);
  });

  // Listen to afterRequestAds events
  moliAdTag.addEventListener('afterRequestAds', (event) => {
    console.log('Ads requested, final state:', event.state);
  });

  // Request ads
  moliAdTag.requestAds();
});
```

### Removing Event Listeners

You can remove event listeners using the `removeEventListener` method:

```ts
const beforeListener = (event) => {
  console.log('Before request ads:', event.runtimeConfig);
};

const afterListener = (event) => {
  console.log('After request ads:', event.state);
};

// Add listeners
moliAdTag.addEventListener('beforeRequestAds', beforeListener);
moliAdTag.addEventListener('afterRequestAds', afterListener);

// Remove listeners
moliAdTag.removeEventListener('beforeRequestAds', beforeListener);
moliAdTag.removeEventListener('afterRequestAds', afterListener);
```

### One-Time Event Listeners

You can create event listeners that automatically remove themselves after being called once:

```ts
moliAdTag.addEventListener('afterRequestAds', (event) => {
  console.log('First ad request completed:', event.state);
}, { once: true });
```

## Common Use Cases

### Performance Tracking

Track the timing of ad requests:

```ts
let requestStartTime: number;

moliAdTag.addEventListener('beforeRequestAds', (event) => {
  requestStartTime = performance.now();
  console.log('Starting ad request at:', requestStartTime);
});

moliAdTag.addEventListener('afterRequestAds', (event) => {
  const requestEndTime = performance.now();
  const duration = requestEndTime - requestStartTime;
  
  console.log('Ad request completed in:', duration, 'ms');
  console.log('Final state:', event.state);
  
  // Send to analytics
  analytics.track('ad_request_duration', {
    duration,
    state: event.state,
    timestamp: Date.now()
  });
});
```

### Error Monitoring

Monitor for ad loading errors:

```ts
moliAdTag.addEventListener('afterRequestAds', (event) => {
  if (event.state === 'error') {
    console.error('Ad request failed');
    
    // Send error to monitoring service
    errorReporting.captureException(new Error('Ad request failed'), {
      tags: {
        component: 'moli-ad-tag',
        event: 'afterRequestAds'
      },
      extra: {
        state: event.state,
        timestamp: Date.now()
      }
    });
  }
});
```

### Analytics Integration

Integrate with analytics systems:

```ts
moliAdTag.addEventListener('beforeRequestAds', (event) => {
  // Track that ads are being requested
  analytics.track('ads_requested', {
    timestamp: Date.now(),
    adSlots: event.runtimeConfig.labels.length,
    targeting: event.runtimeConfig.keyValues
  });
});

moliAdTag.addEventListener('afterRequestAds', (event) => {
  // Track ad request completion
  analytics.track('ads_completed', {
    timestamp: Date.now(),
    state: event.state,
    success: event.state !== 'error'
  });
});
```

### Page View Correlation

Correlate page views with ad requests:

```ts
let pageViewId: string;

// Generate page view ID
pageViewId = generatePageViewId();

moliAdTag.addEventListener('beforeRequestAds', (event) => {
  // Add page view correlation to runtime config
  moliAdTag.setTargeting('page_view_id', pageViewId);
  
  // Track correlation
  analytics.track('page_view_ad_request_correlation', {
    pageViewId,
    timestamp: Date.now(),
    adSlots: event.runtimeConfig.labels.length
  });
});
```

### Debugging

Use events for debugging ad loading issues:

```ts
moliAdTag.addEventListener('beforeRequestAds', (event) => {
  console.group('Ad Request Debug Info');
  console.log('Runtime Config:', event.runtimeConfig);
  console.log('Labels:', event.runtimeConfig.labels);
  console.log('Targeting:', event.runtimeConfig.keyValues);
  console.log('Timestamp:', new Date().toISOString());
  console.groupEnd();
});

moliAdTag.addEventListener('afterRequestAds', (event) => {
  console.group('Ad Request Result');
  console.log('Final State:', event.state);
  console.log('Success:', event.state !== 'error');
  console.log('Timestamp:', new Date().toISOString());
  console.groupEnd();
});
```

## Event Timing

### beforeRequestAds Timing

- Fired after configuration is complete
- Fired before ad requests are made
- DOM is ready at this point
- Perfect for setting up targeting and labels

### afterRequestAds Timing

- Fired after all ad requests are complete
- Fired regardless of success or failure
- Useful for cleanup and analytics

## State Values

The `afterRequestAds` event provides different state values:

- **`'finished'`** - All ads loaded successfully (non-SPA mode)
- **`'spa-finished'`** - All ads loaded successfully (SPA mode)
- **`'error'`** - An error occurred during ad loading

## Multiple Listeners

You can add multiple listeners for the same event:

```ts
// First listener
moliAdTag.addEventListener('afterRequestAds', (event) => {
  console.log('Listener 1: Ads completed with state:', event.state);
});

// Second listener
moliAdTag.addEventListener('afterRequestAds', (event) => {
  analytics.track('ads_completed', { state: event.state });
});

// Third listener
moliAdTag.addEventListener('afterRequestAds', (event) => {
  if (event.state === 'error') {
    errorReporting.captureException(new Error('Ad request failed'));
  }
});
```

## Error Handling

The event system has built-in error handling. If a listener throws an error, it won't prevent other listeners from executing:

```ts
moliAdTag.addEventListener('beforeRequestAds', (event) => {
  // This error won't prevent other listeners from running
  throw new Error('Something went wrong');
});

moliAdTag.addEventListener('beforeRequestAds', (event) => {
  // This listener will still execute
  console.log('This listener runs even if the previous one failed');
});
```

## Single Page Application Support

In SPAs, events are fired for each page navigation:

```ts
moliAdTag.addEventListener('beforeRequestAds', (event) => {
  console.log('Page navigation detected, requesting ads');
  console.log('Current URL:', window.location.href);
});

moliAdTag.addEventListener('afterRequestAds', (event) => {
  if (event.state === 'spa-finished') {
    console.log('SPA page navigation completed');
    // Trigger page view tracking
    analytics.track('spa_page_view', {
      url: window.location.href,
      title: document.title
    });
  }
});
```

## Best Practices

### Listener Registration

Register listeners early in your setup:

```ts
// ✅ Good - Register listeners before configuration
window.moli.que.push(function(moliAdTag) {
  moliAdTag.addEventListener('beforeRequestAds', trackPerformance);
  moliAdTag.addEventListener('afterRequestAds', trackCompletion);
  moliAdTag.requestAds();
});

// ❌ Avoid - Register listeners after configuration
window.moli.que.push(function(moliAdTag) {
  moliAdTag.requestAds();
  moliAdTag.addEventListener('beforeRequestAds', trackPerformance); // Too late!
});
```

### Listener Functions

Keep listener functions focused and lightweight:

```ts
// ✅ Good - Focused listener functions
const trackPerformance = (event) => {
  analytics.track('ad_request_start', {
    timestamp: Date.now(),
    adSlots: event.runtimeConfig.labels.length
  });
};

const trackCompletion = (event) => {
  analytics.track('ad_request_complete', {
    state: event.state,
    success: event.state !== 'error'
  });
};

// ❌ Avoid - Complex logic in listeners
const complexListener = (event) => {
  // Too much logic in one listener
  const userData = fetchUserData();
  const pageData = analyzePage();
  const targeting = calculateTargeting(userData, pageData);
  // ... many more operations
};
```

### Error Handling

Handle errors gracefully in listeners:

```ts
moliAdTag.addEventListener('beforeRequestAds', (event) => {
  try {
    const userSegment = getUserSegment();
    moliAdTag.setTargeting('user_segment', userSegment);
  } catch (error) {
    console.warn('Failed to set user segment:', error);
    // Continue with default targeting
  }
});
```

### Memory Management

Remove listeners when they're no longer needed:

```ts
const performanceListener = (event) => {
  // Track performance
};

// Add listener
moliAdTag.addEventListener('beforeRequestAds', performanceListener);

// Later, remove listener to prevent memory leaks
moliAdTag.removeEventListener('beforeRequestAds', performanceListener);
```

## API Reference

### Available Methods

- `addEventListener(event, listener, options?)` - Add an event listener
- `removeEventListener(event, listener)` - Remove an event listener

For detailed API documentation, see the [MoliTag API reference](/api/types/moliRuntime/namespaces/MoliRuntime/interfaces/MoliTag).

### Event Types

```ts
type EventMap = {
  beforeRequestAds: { runtimeConfig: MoliRuntimeConfig };
  afterRequestAds: { state: 'finished' | 'error' | 'spa-finished' };
};
```

### Listener Options

```ts
interface EventListenerOptions {
  /**
   * When true, the event listener will automatically be removed after it is invoked for the first time.
   * @default false
   */
  readonly once?: boolean;
}
```

### Configuration Notes

- Listeners must be registered before calling `configure()` or `requestAds()`
- Multiple listeners for the same event are supported
- Listeners are called in the order they were registered
- Errors in listeners don't prevent other listeners from executing
- In SPA mode, events are fired for each page navigation
- One-time listeners are automatically removed after execution
