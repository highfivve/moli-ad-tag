---
title: Troubleshooting
---

This guide helps you diagnose and fix common issues with Moli ad tag integration. Learn how to identify problems, use debugging tools, and resolve issues quickly.

## Overview

This troubleshooting guide covers:

- Common integration issues
- Debugging techniques
- Error messages and solutions
- Performance problems
- Testing and validation

## Quick Diagnostic Checklist

Before diving into specific issues, run through this checklist:

- [ ] Moli script is loaded (check Network tab)
- [ ] Google Publisher Tag is loaded
- [ ] Ad slot containers exist in DOM
- [ ] Ad slot IDs match configuration
- [ ] No JavaScript errors in console
- [ ] Debug mode is enabled (if needed)

## Common Issues

### Ads Not Loading

**Symptoms:** Ad containers are empty, no ad requests in Network tab

**Possible Causes:**

1. Moli script not loaded
2. Ad slot IDs don't match configuration
3. JavaScript errors preventing execution
4. Ad blockers interfering

**Solutions:**

1. **Check script loading:**
2. **Verify ad slot IDs:**

    ```html
    <!-- Ensure IDs match your configuration -->
    <div id="header-ad"></div>
    <div id="content-ad"></div>
    <div id="sidebar-ad"></div>
    ```

3. **Check for JavaScript errors:**

    ```ts
    // Add error handling
    window.moli = window.moli || { que: [] };
    window.moli.que.push(function(moliAdTag) {
    try {
        moliAdTag.requestAds();
    } catch (error) {
        console.error('Failed to request ads:', error);
    }
    });
    ```

4. **Test without ad blockers:**
   - Disable ad blockers temporarily
   - Test in incognito mode
   - Check browser extensions

### Wrong Ad Sizes

**Symptoms:** Ads appear in wrong sizes, layout shifts occur

**Possible Causes:**

1. Responsive configuration issues
2. CSS overriding ad container sizes
3. Device detection problems

**Solutions:**

1. **Check responsive configuration:**

    ```css
    /* Ensure proper ad container sizing */
    .ad-container {
        min-height: 250px; /* Reserve space */
        width: 100%;
        max-width: 300px;
    }

    /* Mobile responsive */
    @media (max-width: 768px) {
        .ad-container {
            min-height: 90px;
            max-width: 320px;
        }
    }
    ```

2. **Verify device detection:**

    ```ts
    // Test device detection
    window.moli.que.push(function(moliAdTag) {
        const targeting = moliAdTag.getPageTargeting();
        console.log('Device targeting:', targeting);
    });
    ```

3. **Check CSS conflicts:**

    ```css
    /* Prevent CSS from overriding ad sizes */
    .ad-container iframe {
        width: 100% !important;
        height: 100% !important;
    }
    ```

### Targeting Not Working

**Symptoms:** Ads don't reflect targeting parameters, wrong ads shown

**Possible Causes:**

1. Targeting set after `requestAds()` called
2. Invalid targeting keys/values
3. Targeting not applied correctly

**Solutions:**

1. **Set targeting before requesting ads:**

    ```ts
    // ✅ Correct order
    window.moli.que.push(function(moliAdTag) {
        moliAdTag.setTargeting('page_type', 'homepage');
        moliAdTag.setTargeting('user_segment', 'premium');
        moliAdTag.addLabel('mobile');
        
        moliAdTag.requestAds(); // Call after setting targeting
    });

    // ❌ Wrong order
    window.moli.que.push(function(moliAdTag) {
        moliAdTag.requestAds(); // Too early!
        moliAdTag.setTargeting('page_type', 'homepage'); // Won't work
    });
    ```

2. **Verify targeting values:**

    ```ts
    // Debug targeting
    window.moli.que.push(function(moliAdTag) {
        moliAdTag.setTargeting('page_type', getPageType());
        moliAdTag.setTargeting('user_segment', getUserSegment());
        
        // Log targeting for verification
        const targeting = moliAdTag.getPageTargeting();
        console.log('Current targeting:', targeting);
        
        moliAdTag.requestAds();
    });
    ```

3. **Check targeting format:**

    ```ts
    // Ensure valid targeting format
    moliAdTag.setTargeting('key', 'value'); // String
    moliAdTag.setTargeting('array_key', ['value1', 'value2']); // Array
    moliAdTag.addLabel('label'); // Single label
    ```

### Single Page Application Issues

**Symptoms:** Ads don't refresh on route changes, duplicate ads

**Possible Causes:**

1. SPA mode not enabled
2. Route change detection not working
3. Multiple ad requests triggered

**Solutions:**

1. **Enable SPA mode:**

    ```ts
    const moliConfig = {
        spa: {
            enabled: true,
            validateLocation: 'href' // or 'pathname'
        }
    };
    ```

2. **Handle route changes correctly:**

```tsx
    // React example
    import { useEffect } from 'react';
    import { useLocation } from 'react-router-dom';

    function App() {
        const location = useLocation();

        useEffect(() => {
                window.moli.que.push(function(moliAdTag) {
                moliAdTag.requestAds();
            });
        }, [location]); // Trigger on route change

        return <Routes />;
    }
    ```

3. **Prevent duplicate requests:**

```ts
    // Debounce route changes
    let routeChangeTimeout;
    const handleRouteChange = () => {
        clearTimeout(routeChangeTimeout);
        routeChangeTimeout = setTimeout(() => {
                window.moli.que.push(function(moliAdTag) {
                moliAdTag.requestAds();
            });
        }, 100);
    };
```

## Debugging Techniques

### Enable Debug Mode

Enable Moli's debug console for detailed information:

```ts
// Enable debug mode programmatically
window.moli.que.push(function(moliAdTag) {
  moliAdTag.openConsole();
  moliAdTag.requestAds();
});
```

Or add to URL:

```
https://yoursite.com?moliDebug=true
```

### Browser DevTools

Use browser developer tools for debugging:

1. **Console tab:**
   - Check for JavaScript errors
   - Look for Moli-related messages
   - Verify targeting values

2. **Network tab:**
   - Monitor ad requests
   - Check response status codes
   - Verify request parameters

3. **Elements tab:**
   - Inspect ad containers
   - Check for CSS conflicts
   - Verify DOM structure

### Custom Debugging

Add custom debugging code:

```ts
// Debug ad loading process
window.moli.que.push(function(moliAdTag) {
  // Debug targeting
  console.group('Moli Debug Info');
  console.log('Ad slot IDs:', ['header-ad', 'content-ad', 'sidebar-ad']);
  console.log('Page URL:', window.location.href);
  console.log('User Agent:', navigator.userAgent);
  
  // Set up event listeners for debugging
  moliAdTag.addEventListener('beforeRequestAds', (event) => {
    console.log('Before requesting ads:', event.runtimeConfig);
  });
  
  moliAdTag.addEventListener('afterRequestAds', (event) => {
    console.log('After requesting ads:', event.state);
  });
  
  console.groupEnd();
  
  moliAdTag.requestAds();
});
```

## Error Messages

### Common Error Messages

**"Moli script not loaded"**

- Check script URL is correct
- Verify script is loading in Network tab
- Check for 404 errors

**"Ad slot not found"**

- Verify ad slot ID exists in DOM
- Check for typos in slot IDs
- Ensure containers are created before requesting ads

**"Invalid targeting key"**

- Check targeting key format
- Ensure keys are strings
- Verify no special characters

**"Request ads called too early"**

- Ensure Moli is initialized before calling `requestAds()`
- Check script loading order
- Verify command queue is set up

### Error Handling

Implement proper error handling:

```ts
// Comprehensive error handling
window.moli = window.moli || { que: [] };

window.moli.que.push(function(moliAdTag) {
  try {
    // Set up error monitoring
    moliAdTag.addEventListener('afterRequestAds', (event) => {
      if (event.state === 'error') {
        console.error('Ad request failed:', event);
        
        // Send error to monitoring service
        errorReporting.captureException(new Error('Ad request failed'), {
          tags: { component: 'moli-ad-tag' },
          extra: { state: event.state }
        });
      }
    });
    
    // Set targeting with validation
    const targeting = {
      page_type: getPageType(),
      user_segment: getUserSegment()
    };
    
    Object.entries(targeting).forEach(([key, value]) => {
      if (value && typeof value === 'string') {
        moliAdTag.setTargeting(key, value);
      }
    });
    
    moliAdTag.requestAds();
    
  } catch (error) {
    console.error('Moli initialization failed:', error);
    
    // Fallback behavior
    showFallbackContent();
  }
});
```

## Performance Issues

### Layout Shifts

**Symptoms:** Page content jumps when ads load

**Solutions:**

1. **Reserve space for ads:**

    ```css
    .ad-container {
        min-height: 250px; /* Reserve space */
        background: #f0f0f0; /* Placeholder */
    }
    ```

2. **Use CSS containment:**

    ```css
    .ad-container {
        contain: layout style paint;
        min-height: 250px;
    }
    ```

3. **Smooth transitions:**

    ```css
    .ad-container {
        transition: height 0.3s ease;
    }
    ```

## Testing and Validation

### Unit Testing

Test Moli integration with Jest:

```ts
// Mock Moli for testing
const mockMoliAdTag = {
  requestAds: jest.fn(),
  setTargeting: jest.fn(),
  addLabel: jest.fn(),
  getPageTargeting: jest.fn(),
  addEventListener: jest.fn()
};

global.window.moli = {
  que: []
};

beforeEach(() => {
  global.window.moli.que = [];
  jest.clearAllMocks();
});

test('should request ads with correct targeting', () => {
  // Test implementation
  window.moli.que.push(function(moliAdTag) {
    moliAdTag.setTargeting('page_type', 'homepage');
    moliAdTag.requestAds();
  });
  
  expect(mockMoliAdTag.setTargeting).toHaveBeenCalledWith('page_type', 'homepage');
  expect(mockMoliAdTag.requestAds).toHaveBeenCalled();
});
```

### Integration Testing

A basic test case is to validate that the `moli.que` is being processed.

```ts
const spy = sandbox.spy();
moli.moli.que.push(spy);
await new Promise(resolve => window.moli.que.push(resolve)); // requires a timeout 
expect(spy).to.have.been.called;
```

### Manual Testing

Create a testing checklist:

- [ ] Ads load on page load
- [ ] Ads refresh on route changes (SPA)
- [ ] Targeting works correctly
- [ ] Responsive ads display properly
- [ ] No console errors
- [ ] Performance is acceptable
- [ ] Layout shifts are minimal

## Getting Help

### Self-Service Resources

1. **Check the documentation:**
   - [API Reference](/api)
   - [Feature guides](/docs/features)
   - [Integration guides](/docs/guides)

2. **Use debugging tools:**
   - Enable debug mode
   - Check browser console
   - Monitor network requests

3. **Test in isolation:**
   - Create minimal test case
   - Test without other scripts
   - Verify in different browsers

### Contact Highfivve

We are always happy to help.

## Best Practices

### Prevention

1. **Test thoroughly:**
   - Test in multiple browsers
   - Test on different devices
   - Test with different configurations

2. **Monitor performance:**
   - Track Core Web Vitals
   - Monitor ad load times
   - Watch for errors

3. **Use error handling:**
   - Implement try-catch blocks
   - Add fallback behavior
   - Monitor for failures

### Maintenance

1. **Keep updated:**
   - Update Moli version regularly
   - Monitor for breaking changes
   - Test after updates

2. **Monitor analytics:**
   - Track ad performance
   - Monitor user experience
   - Watch for anomalies

3. **Document changes:**
   - Keep integration notes
   - Document customizations
   - Track configuration changes
