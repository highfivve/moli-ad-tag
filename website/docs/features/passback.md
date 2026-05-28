---
title: Passback Bridge
---

The passback bridge enables communication between ad creatives and the Moli ad tag through the `postMessage` API. This feature allows third-party creatives to trigger ad slot refreshes or indicate passback scenarios when they cannot serve ads.

## Overview

The passback bridge is a communication protocol that enables:

- **Backfill Integration**: When a direct integration doesn't fill, creatives can trigger backfill ad slots
- **Cross-Ad Server Communication**: Calling into Google Ad Manager from another ad server when there's no demand
- **Creative-to-Ad Tag Communication**: Secure communication between iframe creatives and the parent page

## Configuration

Enable the passback bridge in your Moli configuration:

```ts
const moliConfig = {
  // ... other configuration
  bridge: {
    enabled: true
  }
};
```

## Message Protocol

The bridge supports two types of messages:

### 1. Refresh Ad Unit Message

Triggers a backfill ad slot refresh:

```ts
{
  event: 'h5.adunit.refresh',
  domId: 'banner-top'
}
```

**Parameters:**

- `event`: Must be `'h5.adunit.refresh'`
- `domId`: The DOM ID of the ad slot to refresh

### 2. Passback Message

Indicates a passback scenario and adds targeting parameters:

```ts
{
  event: 'h5.adunit.passback',
  domId: 'banner-top',
  adUnitPath: '/123,456/banner-top',
  passbackOrigin: 'AdvertiserName'
}
```

**Parameters:**

- `event`: Must be `'h5.adunit.passback'`
- `domId`: The DOM ID of the ad slot (fallback if `adUnitPath` not provided)
- `adUnitPath`: The ad unit path (preferred method)
- `passbackOrigin`: Name of the advertiser triggering the passback

## Implementation Examples

### Basic Creative Integration

```html
<script>
// Simple passback trigger
function triggerPassback() {
  const message = {
    event: 'h5.adunit.passback',
    domId: 'banner-top',
    passbackOrigin: 'ExampleAdvertiser'
  };
  
  try {
    // Try to post to top window first
    window.top.postMessage(message, '*');
  } catch (_) {
    // Fallback to current window
    window.postMessage(message, '*');
  }
}

// Trigger passback when no ad is available
if (!hasAdToShow) {
  triggerPassback();
}
</script>
```

### Advanced Creative with Ad Unit Path

```html
<script>
function triggerPassbackWithAdUnitPath() {
  const message = {
    event: 'h5.adunit.passback',
    adUnitPath: '%%ADUNIT%%', // GAM macro
    passbackOrigin: 'PremiumAdvertiser'
  };
  
  const request = JSON.stringify(message);
  
  try {
    window.top.postMessage(request, '*');
  } catch (_) {
    window.postMessage(request, '*');
  }
}
</script>
```

### Backfill Integration

```html
<script>
function triggerBackfill() {
  const message = {
    event: 'h5.adunit.refresh',
    domId: 'backfill-slot'
  };
  
  window.top.postMessage(message, '*');
}

// Trigger backfill when direct integration fails
if (directAdFailed) {
  triggerBackfill();
}
</script>
```

## Use Cases

### 1. Backfill Integration

When a direct ad integration doesn't fill, creatives can trigger backfill ad slots:

```ts
// Creative detects no fill
if (!adResponse || adResponse.isEmpty()) {
  const backfillMessage = {
    event: 'h5.adunit.refresh',
    domId: 'backfill-banner'
  };
  
  window.top.postMessage(backfillMessage, '*');
}
```

**Requirements:**

- The target ad slot must have `loaded: 'backfill'` behavior
- The creative must have permission to communicate with the parent page

### 2. Cross-Ad Server Communication

Enable communication between different ad servers when there's no demand:

```ts
// Ad server A has no demand, trigger Ad server B
const passbackMessage = {
  event: 'h5.adunit.passback',
  adUnitPath: '/123,456/content-banner',
  passbackOrigin: 'AdServerA'
};

window.top.postMessage(passbackMessage, '*');
```

**Benefits:**

- Maintains existing targeting parameters
- Adds `passback: true` and `passbackOrigin` targeting
- Triggers a new ad request with updated parameters

## Targeting Parameters

When a passback message is processed, the following targeting parameters are automatically added:

- `passback: true` - Indicates this is a passback request
- `passbackOrigin: [advertiser-name]` - The origin of the passback

These parameters are preserved in subsequent ad requests, allowing for:

- Different line item targeting for passback scenarios
- Analytics and reporting on passback performance
- Custom logic based on passback origin

## Security Considerations

### Origin Validation

The bridge accepts messages from any origin (`'*'`). For production environments, consider:

```ts
// More secure implementation
function sendSecureMessage(message, allowedOrigin) {
  if (window.top.origin === allowedOrigin) {
    window.top.postMessage(message, allowedOrigin);
  }
}
```

### Message Validation

The bridge validates all incoming messages:

- Checks for required event types
- Validates message structure
- Handles JSON parsing errors gracefully

## Error Handling

The bridge includes robust error handling:

```ts
// Creative-side error handling
function safePostMessage(message) {
  try {
    const serialized = JSON.stringify(message);
    window.top.postMessage(serialized, '*');
  } catch (error) {
    console.warn('Failed to send passback message:', error);
    // Fallback behavior
  }
}
```

## Best Practices

### 1. Use Ad Unit Path When Possible

Prefer `adUnitPath` over `domId` for better compatibility:

```ts
// ✅ Preferred
{
  event: 'h5.adunit.passback',
  adUnitPath: '/123,456/banner-top',
  passbackOrigin: 'Advertiser'
}

// ⚠️ Fallback
{
  event: 'h5.adunit.passback',
  domId: 'banner-top',
  passbackOrigin: 'Advertiser'
}
```

### 2. Implement Fallback Logic

Always include fallback mechanisms:

```ts
function triggerPassback() {
  const message = {
    event: 'h5.adunit.passback',
    domId: 'banner-top',
    passbackOrigin: 'Advertiser'
  };
  
  try {
    window.top.postMessage(message, '*');
  } catch (_) {
    // Fallback for same-origin scenarios
    window.postMessage(message, '*');
  }
}
```

### 3. Monitor Passback Performance

Track passback scenarios for optimization:

```ts
// Add analytics tracking
function trackPassback(origin) {
  if (typeof gtag !== 'undefined') {
    gtag('event', 'passback_triggered', {
      'passback_origin': origin,
      'ad_slot': 'banner-top'
    });
  }
}
```

## Troubleshooting

### Common Issues

1. **Message Not Received**
   - Check if bridge is enabled in configuration
   - Verify message format and event type
   - Ensure creative has permission to post messages

2. **Ad Slot Not Found**
   - Verify `domId` or `adUnitPath` matches configured slots
   - Check that target slot exists and is properly configured

3. **Backfill Not Triggering**
   - Ensure target slot has `loaded: 'backfill'` behavior
   - Verify slot is properly configured for backfill scenarios

### Debug Mode

Enable debug logging to troubleshoot issues:

```ts
// Check browser console for bridge messages
// Look for: "bridge: add message listener"
// Look for: "passback: Process passback for ad slot [path]"
```

## Integration Checklist

- [ ] Enable bridge in Moli configuration
- [ ] Configure backfill ad slots with `loaded: 'backfill'`
- [ ] Implement passback logic in creatives
- [ ] Test message communication
- [ ] Verify targeting parameters are set correctly
- [ ] Monitor passback performance and analytics
