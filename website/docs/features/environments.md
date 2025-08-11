---
title: Environments
---

Moli supports two environments to help you manage different configurations for testing and production. Each environment has specific behaviors for ad requests and consent management.

## Overview

Environments allow you to:

- Test ad tag configurations without firing real ad requests
- Use test creatives for development and testing
- Manage consent requirements appropriately for each environment
- Ensure production traffic uses real ad units and proper consent

## Available Environments

### Test

- **Purpose**: Development and testing without real ad requests
- **Features**:
  - Shows test creatives without firing ad requests to ad servers
  - Consent management is deactivated
  - Ideal for development and testing scenarios
- **Use Case**: Developer testing, QA testing, and feature development

### Production

- **Purpose**: Live website traffic with real advertising
- **Features**:
  - Fires real ad requests to ad servers
  - Full consent management enabled
  - Real ad units and monetization
- **Use Case**: End users and real advertising

## Environment Configuration

### Basic Environment Setup

Set the environment in your configuration:

```ts
const moliConfig: Moli.MoliConfig = {
  // highlight-start
  environment: 'test', // 'test' or 'production'
  // highlight-end
  slots: [ /* ... */ ]
};
```

### Environment-Specific Configuration

Configure different settings for each environment:

```ts
const getEnvironmentConfig = () => {
  // Determine environment based on your own logic
  const environment = window.location.hostname.includes('test') || 
                           window.location.hostname.includes('localhost') ? 'test' : 'production'; 
  
  return {
    environment: environment,
    slots: [
        {
            domId: 'content_1',
            adUnitPath: '/1234/test_content_1',
            sizes: [[300, 250]],
            position: 'in-page',
            behaviour: { loaded: 'eager' }
        }
        ]
    };
};

const moliConfig = getEnvironmentConfig();
```

## API Reference

### Environment Property

The `environment` property in `MoliConfig` accepts:

- `'test'` - Test environment (no real ad requests, consent deactivated)
- `'production'` - Production environment (real ad requests, full consent)

### Environment-Specific Behavior

Each environment has different default behaviors:

- **Test**: No ad requests fired, test creatives shown, consent deactivated
- **Production**: Real ad requests, production ad units, full consent management

For detailed API documentation, see the [MoliTag API reference](/api/types/moliRuntime/namespaces/MoliRuntime/interfaces/MoliTag).
