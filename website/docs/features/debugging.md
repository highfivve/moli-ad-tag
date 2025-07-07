---
title: Debugging
---

Moli provides debugging tools to help you troubleshoot ad tag issues, monitor performance, and inspect configuration. The debugging system includes a debug console and various debugging parameters.

## Overview

The debugging system helps you:

- Inspect ad tag configuration and state
- Monitor network requests and responses
- Debug consent and targeting issues
- Analyze ad loading behavior

## Enabling Debug Mode

### Using Query Parameter

Enable debug mode by adding the `moliDebug` parameter to your URL:

```
https://yoursite.com?moliDebug=true
```

### Using Session Storage

Enable debug mode for the current session:

```ts
// Enable debug mode for current session
sessionStorage.setItem('moliDebug', 'true');

// Disable debug mode
sessionStorage.removeItem('moliDebug');
```

### Using Local Storage

Enable debug mode persistently across sessions:

```ts
// Enable debug mode persistently
localStorage.setItem('moliDebug', 'true');

// Disable debug mode
localStorage.removeItem('moliDebug');
```

## Debug Console

### Opening the Debug Console

Use the `openConsole` method to open the Moli debug console:

```ts
// Open debug console
window.moli.openConsole();
```

### Debug Console Features

The debug console provides:

- **Configuration Inspector**: View current ad tag configuration
- **State Inspector**: View current ad tag state
- **Targeting Inspector**: View current targeting values
- **Consent Monitor**: Check consent state and TCF2 data

## Debug Logging

When debug mode is enabled, Moli provides detailed logging:

```ts
// Example debug output
[DEBUG] AdPipeline Ad slot configured for content_1
[INFO] GAM Ad request sent to /1234/content_1
[WARN] Prebid Bid timeout for slot content_1
[ERROR] AdPipeline Failed to load ad for content_1
```

### Log Sources

Debug logs are categorized by source:

- **AdPipeline** - Ad loading and processing pipeline
- **GAM** - Google Ad Manager operations
- **Prebid** - Header bidding operations
- **MoliGlobal** - Global ad tag operations
- **AdVisibilityService** - Ad visibility tracking
- **UserActivityService** - User activity monitoring

## Test Environment

You can enable the `test` environment to enable test creatives that are rendered without any ad requests.
This is useful for

- initial integration checks
- size config validation
- correct ad slot placement on the page

You can permanently enable the test mode, e.g. in staging environments through the configuration like this.

```ts
const moliConfig: Moli.MoliConfig = {
  environment: 'test',
  slots: [ /* ... */ ]
};

// No real ad requests are made
```

## Debug Console Integration

### Custom Debug Path

You can specify a custom path for the debug console script:

```ts
// Open debug console with custom path
window.moli.openConsole('https://custom-debug-path.com/debug.js');
```

### Debug Console Events

The debug console provides real-time updates:

- Configuration changes
- Ad loading events
- Error occurrences

## Best Practices

### Temporary Debugging

```ts
// ✅ Good - Enable debug mode temporarily
localStorage.setItem('moliDebug', 'true');

// Debug your issue...

// Disable when done
localStorage.removeItem('moliDebug');

// ❌ Avoid - Leave debug mode enabled in production
localStorage.setItem('moliDebug', 'true'); // Always enabled
```

### Debug Console Usage

```ts
// ✅ Good - Open console after configuration
window.moli.que.push(function(moliAdTag) {
  moliAdTag.configure(config);
  moliAdTag.openConsole(); // Open after configuration
  moliAdTag.requestAds();
});

// ❌ Avoid - Open console before configuration
window.moli.openConsole(); // May not work properly
```


## API Reference

### Available Methods

- `openConsole(path?)` - Open the Moli debug console

For detailed API documentation, see the [MoliTag API reference](/api/types/moliRuntime/namespaces/MoliRuntime/interfaces/MoliTag).

### Debug Parameter

The `moliDebug` parameter can be set via:

- Query parameter: `?moliDebug=true`
- Session storage: `sessionStorage.setItem('moliDebug', 'true')`
- Local storage: `localStorage.setItem('moliDebug', 'true')`

When enabled, detailed logging will be output to the console and the debug console will be available.
