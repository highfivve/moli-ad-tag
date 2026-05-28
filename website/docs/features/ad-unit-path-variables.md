---
title: Ad Unit Path Variables
---

Moli provides a dynamic ad unit path system that allows you to use variables in your ad unit paths. This feature enables you to create flexible ad unit paths that can adapt to different devices, domains, or other contextual information.

## Overview

Ad unit path variables help you:

- Create dynamic ad unit paths based on device type
- Include domain information in ad unit paths
- Add custom variables for targeting and organization
- Maintain consistent ad unit path structure across different contexts
- Support multi-domain setups with shared configurations

## How It Works

Ad unit paths can contain variables in curly braces `{variable_name}`. These variables are replaced with actual values when ads are requested. The system supports both built-in variables and custom variables.

### Built-in Variables

Moli automatically provides these variables:

- **`{device}`** - The device type (`mobile` or `desktop`)
- **`{domain}`** - The top-level domain of the current page

### Custom Variables

You can define additional custom variables for your specific needs.

## Basic Usage

### Setting Ad Unit Path Variables

You can set ad unit path variables using the `setAdUnitPathVariables` method:

```ts
window.moli = window.moli || { que: [] };
window.moli.que.push(function(moliAdTag) {
  // Set custom variables
  moliAdTag.setAdUnitPathVariables({
    channel: 'organic',
    section: 'sports',
    user_type: 'premium'
  });

  // Request ads
  moliAdTag.requestAds();
});
```

### Using Variables in Ad Unit Paths

Define ad unit paths with variables in your configuration:

```ts
const moliConfig = {
  slots: [
    {
      domId: 'header-ad',
      adUnitPath: '/1234567/{device}/{domain}/{section}',
      // ... other configuration
    },
    {
      domId: 'sidebar-ad',
      adUnitPath: '/1234567/{device}/{domain}/{channel}',
      // ... other configuration
    }
  ]
};
```

### Resolving Ad Unit Paths

You can manually resolve ad unit paths to see the final result:

```ts
// Resolve a path with current variables
const resolvedPath = moliAdTag.resolveAdUnitPath('/1234567/{device}/{domain}/{section}');
console.log(resolvedPath); // e.g., "/1234567/mobile/example.com/sports"

// Resolve with custom options
const resolvedPath = moliAdTag.resolveAdUnitPath('/1234567,1234/{device}/{domain}', {
  removeNetworkChildId: true
});
console.log(resolvedPath); // e.g., "/1234567/mobile/example.com" (child ID removed)
```

## Variable Resolution

### Automatic Resolution

Variables are automatically resolved when ads are requested. The resolution process:

1. **Built-in variables** are set automatically:
   - `{device}` - Determined by the device detection system
   - `{domain}` - Extracted from the current page URL

2. **Custom variables** are merged from:
   - Static configuration in `MoliConfig.targeting.adUnitPathVariables`
   - Runtime variables set via `setAdUnitPathVariables()`
   - Runtime variables take precedence over static configuration

### Resolution Order

Variables are resolved in this order:

1. Built-in variables (`device`, `domain`)
2. Static configuration variables
3. Runtime variables (highest precedence)

## Common Use Cases

### Device-Specific Ad Unit Paths

Create different ad unit paths for mobile and desktop:

```ts
// Configuration
const moliConfig = {
  slots: [
    {
      domId: 'header-ad',
      adUnitPath: '/1234567/{device}/header',
      // ... other configuration
    }
  ]
};

// This resolves to:
// Mobile: /1234567/mobile/header
// Desktop: /1234567/desktop/header
```

### Domain-Specific Targeting

Include domain information for multi-site setups:

```ts
// Configuration
const moliConfig = {
  slots: [
    {
      domId: 'content-ad',
      adUnitPath: '/1234567/{device}/{domain}/content',
      // ... other configuration
    }
  ]
};

// This resolves to:
// example.com: /1234567/mobile/example.com/content
// news.example.com: /1234567/mobile/news.example.com/content
```

### Content-Specific Targeting

Add content-specific variables:

```ts
// Set variables based on page content
moliAdTag.setAdUnitPathVariables({
  section: getCurrentSection(), // e.g., 'sports', 'news', 'entertainment'
  category: getCurrentCategory(), // e.g., 'football', 'politics', 'movies'
  user_segment: getUserSegment() // e.g., 'premium', 'standard'
});

// Configuration
const moliConfig = {
  slots: [
    {
      domId: 'sidebar-ad',
      adUnitPath: '/1234567/{device}/{domain}/{section}/{category}',
      // ... other configuration
    }
  ]
};

// This resolves to:
// /1234567/mobile/example.com/sports/football
```

### Multi-Network Support

Handle Google Ad Manager's multi-customer management (MCM) child IDs:

```ts
// Configuration with child network ID
const moliConfig = {
  slots: [
    {
      domId: 'header-ad',
      adUnitPath: '/1234567,1234/{device}/{domain}/header',
      // ... other configuration
    }
  ]
};

// Normal resolution (keeps child ID)
const normalPath = moliAdTag.resolveAdUnitPath('/1234567,1234/{device}/{domain}/header');
// Result: /1234567,1234/mobile/example.com/header

// Resolution with child ID removal
const cleanPath = moliAdTag.resolveAdUnitPath('/1234567,1234/{device}/{domain}/header', {
  removeNetworkChildId: true
});
// Result: /1234567/mobile/example.com/header
```

## Advanced Features

### Variable Validation

The system validates variable names and provides helpful error messages:

```ts
// ❌ Invalid variable name (contains special characters)
moliAdTag.resolveAdUnitPath('/1234567/{invalid-name}');
// Throws: SyntaxError: invalid variable "invalid-name" in path

// ❌ Undefined variable
moliAdTag.resolveAdUnitPath('/1234567/{undefined_var}');
// Throws: ReferenceError: path variable "undefined_var" is not defined

// ✅ Valid variable name
moliAdTag.resolveAdUnitPath('/1234567/{valid_var}');
// Works correctly
```

### Variable Reuse

You can use the same variable multiple times in a path:

```ts
moliAdTag.setAdUnitPathVariables({
  device: 'mobile',
  section: 'sports'
});

const path = moliAdTag.resolveAdUnitPath('/1234567/{device}/{section}-{device}');
console.log(path); // "/1234567/mobile/sports-mobile"
```

### Conditional Variables

Set variables conditionally based on page context:

```ts
moliAdTag.setAdUnitPathVariables({
  section: window.location.pathname.includes('/sports/') ? 'sports' : 'general',
  user_type: isPremiumUser() ? 'premium' : 'standard',
  ad_position: getAdPosition()
});
```

## Integration with Other Features

### Prebid Integration

Ad unit path variables work seamlessly with Prebid.js:

```ts
// Prebid configuration with dynamic ad unit paths
const moliConfig = {
  slots: [
    {
      domId: 'header-ad',
      adUnitPath: '/1234567/{device}/{domain}/header',
      prebid: {
        adUnit: {
          pubstack: {
            adUnitPath: '/1234567/{device}/{domain}/header'
          }
        }
      }
    }
  ]
};
```

### Amazon TAM Integration

Variables are resolved for Amazon TAM slot names:

```ts
// TAM configuration with dynamic slot names
const moliConfig = {
  slots: [
    {
      domId: 'header-ad',
      adUnitPath: '/1234567/{device}/{domain}/header',
      a9: {
        slotName: '/1234567/{device}/{domain}/header'
      }
    }
  ]
};
```

### Frequency Capping

Variables are resolved for frequency capping configurations:

```ts
const moliConfig = {
  frequencyCapping: {
    enabled: true,
    positions: [
      {
        adUnitPath: '/1234567/{device}/{domain}/header',
        conditions: {
          pacingInterval: { intervalInMs: 30000, maxImpressions: 2 }
        }
      }
    ]
  }
};
```

## Best Practices

### Variable Naming

Use descriptive, consistent variable names:

```ts
// ✅ Good - Clear, descriptive names
moliAdTag.setAdUnitPathVariables({
  content_section: 'sports',
  user_segment: 'premium',
  ad_position: 'header'
});

// ❌ Avoid - Unclear or inconsistent names
moliAdTag.setAdUnitPathVariables({
  s: 'sports',
  u: 'premium',
  pos: 'header'
});
```

### Variable Organization

Group related variables logically:

```ts
// ✅ Good - Organized by purpose
moliAdTag.setAdUnitPathVariables({
  // Content context
  section: 'sports',
  category: 'football',
  
  // User context
  user_type: 'premium',
  user_segment: 'high_value',
  
  // Technical context
  ad_position: 'header',
  ad_format: 'banner'
});
```

### Error Handling

Handle missing variables gracefully:

```ts
try {
  const resolvedPath = moliAdTag.resolveAdUnitPath('/1234567/{device}/{section}');
  console.log('Resolved path:', resolvedPath);
} catch (error) {
  if (error instanceof ReferenceError) {
    console.warn('Missing variable in ad unit path:', error.message);
    // Fall back to default path
  } else {
    console.error('Error resolving ad unit path:', error);
  }
}
```

### Performance Considerations

Set variables early in the process:

```ts
// ✅ Good - Set variables before configuration
window.moli.que.push(function(moliAdTag) {
  moliAdTag.setAdUnitPathVariables({
    section: getCurrentSection(),
    user_type: getUserType()
  });
  moliAdTag.requestAds();
});

// ❌ Avoid - Setting variables after configuration
window.moli.que.push(function(moliAdTag) {
  moliAdTag.requestAds();
  moliAdTag.setAdUnitPathVariables({ section: 'sports' }); // Too late!
});
```

## API Reference

### Available Methods

- `setAdUnitPathVariables(variables)` - Set custom ad unit path variables
- `resolveAdUnitPath(path, options?)` - Manually resolve an ad unit path
- `getAdUnitPathVariables()` - Get current ad unit path variables

For detailed API documentation, see the [MoliTag API reference](/api/types/moliRuntime/namespaces/MoliRuntime/interfaces/MoliTag).

### Variable Types

```ts
type AdUnitPathVariables = {
  [key: string]: string;
};

type ResolveAdUnitPathOptions = {
  removeNetworkChildId?: boolean;
};
```

### Built-in Variables

- `{device}` - Device type (`mobile` or `desktop`)
- `{domain}` - Top-level domain of the current page

### Configuration Notes

- Variables must be valid JavaScript identifiers (letters, numbers, underscores)
- Undefined variables will cause resolution errors
- Runtime variables override static configuration variables
- Variables are resolved when ads are requested
- Child network IDs can be removed with the `removeNetworkChildId` option
