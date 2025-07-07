---
title: Logging
---

Moli provides a logging system to help you monitor ad tag events and debug issues. The logger can be configured to output different levels of information and can be customized to integrate with external logging services.

## Overview

The logging system helps you:

- Monitor ad loading and auction processes
- Debug configuration and runtime issues
- Integrate with external monitoring services
- Maintain audit trails for compliance

## Log Levels

### Available Log Levels

Moli supports standard log levels:

- **error** - Critical errors that prevent functionality
- **warn** - Warning messages about potential issues
- **info** - General information about ad tag operations
- **debug** - Detailed debugging information

### Log Level Hierarchy

```ts
// Most verbose to least verbose
debug > info > warn > error
```

## Enabling Logging

### Using Query Parameter

Enable logging by adding the `moliDebug` parameter to your URL:

```
https://yoursite.com?moliDebug=true
```

### Using Session Storage

Enable logging for the current session:

```ts
// Enable logging for current session
sessionStorage.setItem('moliDebug', 'true');

// Disable logging
sessionStorage.removeItem('moliDebug');
```

### Using Local Storage

Enable logging persistently across sessions:

```ts
// Enable logging persistently
localStorage.setItem('moliDebug', 'true');

// Disable logging
localStorage.removeItem('moliDebug');
```

## Default Logger

When logging is enabled, Moli uses a default logger that writes to the console with colored labels:

```ts
// Example of default logger output
[DEBUG] AdPipeline Ad slot configured for content_1
[INFO] GAM Ad request sent to /1234/content_1
[WARN] Prebid Bid timeout for slot content_1
[ERROR] AdPipeline Failed to load ad for content_1
```

The default logger includes:

- Colored labels for log levels and sources
- Source identification (AdPipeline, GAM, Prebid, etc.)
- Full message details and optional parameters

## Custom Logger

### Setting a Custom Logger

Implement your own logging logic using the `setLogger` method:

```ts
window.moli = window.moli || { que: [] };
window.moli.que.push(function(moliAdTag) {
  // Set custom logger
  moliAdTag.setLogger(customLogger);
});
```

### Custom Logger Implementation

Implement the `MoliLogger` interface:

```ts
const customLogger = {
  error(message?: any, ...optionalParams: any[]): void {
    // Send to error tracking service
    Sentry.captureException(new Error(message), { extra: optionalParams });
    console.error(`[Moli Error] ${message}`, ...optionalParams);
  },
  
  warn(message?: any, ...optionalParams: any[]): void {
    // Log warnings
    console.warn(`[Moli Warning] ${message}`, ...optionalParams);
  },
  
  info(message?: any, ...optionalParams: any[]): void {
    // Log info messages
    console.info(`[Moli Info] ${message}`, ...optionalParams);
  },
  
  debug(message?: any, ...optionalParams: any[]): void {
    // Only log in development
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[Moli Debug] ${message}`, ...optionalParams);
    }
  }
};
```

### External Logging Integration

Integrate with external logging services:

```ts
const externalLogger = {
  error(message?: any, ...optionalParams: any[]): void {
    // Send to external service
    fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        level: 'error',
        message: String(message),
        params: optionalParams,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent
      })
    });
  },
  
  info(message?: any, ...optionalParams: any[]): void {
    // Send to analytics
    analytics.track('ad_tag_log', {
      level: 'info',
      message: String(message),
      params: optionalParams
    });
  },
  
  warn(message?: any, ...optionalParams: any[]): void {
    // Log warnings
    console.warn(`[Moli Warning] ${message}`, ...optionalParams);
  },
  
  debug(message?: any, ...optionalParams: any[]): void {
    // Debug logging
    console.debug(`[Moli Debug] ${message}`, ...optionalParams);
  }
};

window.moli = window.moli || { que: [] };
window.moli.que.push(function(moliAdTag) {
  moliAdTag.setLogger(externalLogger);
});
```

### Noop Logger

Disable all logging except errors:

```ts
const noopLogger = {
  debug: () => { return; },
  info: () => { return; },
  warn: () => { return; },
  error: console.error // Still log errors to console
};

window.moli = window.moli || { que: [] };
window.moli.que.push(function(moliAdTag) {
  moliAdTag.setLogger(noopLogger);
});
```

## Environment-Specific Logging

### Development Logging

```ts
// Enable debug logging in development
if (process.env.NODE_ENV === 'development') {
  localStorage.setItem('moliDebug', 'true');
}

// Or use custom logger for development
const devLogger = {
  error: console.error,
  warn: console.warn,
  info: console.info,
  debug: console.debug
};

window.moli = window.moli || { que: [] };
window.moli.que.push(function(moliAdTag) {
  moliAdTag.setLogger(devLogger);
});
```

### Production Logging

```ts
// Use minimal logging in production
const prodLogger = {
  error: (message, ...params) => {
    // Send errors to monitoring service
    errorTracking.captureError(message, params);
  },
  warn: () => { return; }, // Disable warnings
  info: () => { return; }, // Disable info
  debug: () => { return; } // Disable debug
};

window.moli = window.moli || { que: [] };
window.moli.que.push(function(moliAdTag) {
  moliAdTag.setLogger(prodLogger);
});
```

## Log Sources

The default logger identifies different sources of log messages:

- **AdPipeline** - Ad loading and processing pipeline
- **GAM** - Google Ad Manager operations
- **Prebid** - Header bidding operations
- **MoliGlobal** - Global ad tag operations
- **AdVisibilityService** - Ad visibility tracking
- **UserActivityService** - User activity monitoring
- **Adex DMP** - Data management platform

## Best Practices

### Appropriate Log Levels

```ts
// ✅ Good - Use appropriate levels
logger.error('Ad failed to load', { slotId: 'content_1' });
logger.warn('Consent not available', { timeout: 5000 });
logger.info('Ad slot configured', { slotId: 'content_1' });
logger.debug('Network request details', { url: '/ad-request' });

// ❌ Avoid - Don't use debug for important info
logger.debug('Ad failed to load', { slotId: 'content_1' });
```

### Performance Considerations

```ts
// ✅ Good - Conditional logging
if (process.env.NODE_ENV === 'development') {
  logger.debug('Detailed debug info', context);
}

// ❌ Avoid - Always logging debug info
logger.debug('Detailed debug info', context); // Always executes
```

### Error Handling

```ts
const safeLogger = {
  error: (message, ...params) => {
    try {
      // Send to error tracking
      errorTracking.captureError(message, params);
    } catch (e) {
      // Fallback to console
      console.error('[Moli Error]', message, ...params);
    }
  },
  warn: console.warn,
  info: console.info,
  debug: console.debug
};
```

## API Reference

### MoliLogger Interface

```ts
interface MoliLogger {
  debug(message?: any, ...optionalParams: any[]): void;
  info(message?: any, ...optionalParams: any[]): void;
  warn(message?: any, ...optionalParams: any[]): void;
  error(message?: any, ...optionalParams: any[]): void;
}
```

### Available Methods

- `setLogger(logger)` - Set a custom logger implementation

For detailed API documentation, see the [MoliTag API reference](/api/types/moliRuntime/namespaces/MoliRuntime/interfaces/MoliTag).

### Debug Parameter

The `moliDebug` parameter can be set via:

- Query parameter: `?moliDebug=true`
- Session storage: `sessionStorage.setItem('moliDebug', 'true')`
- Local storage: `localStorage.setItem('moliDebug', 'true')`

When enabled, the default logger will be used unless a custom logger is set via `setLogger()`.
