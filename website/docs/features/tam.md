---
title: Amazon TAM
---

Moli provides native integration with Amazon's Transparent Ad Marketplace (TAM), allowing you to include Amazon as a header bidding partner alongside Prebid.js. TAM enables access to Amazon's demand sources and provides additional revenue opportunities.

## Overview

Amazon TAM integration helps you:

- Access Amazon's demand sources and advertisers
- Increase competition in your ad auctions
- Improve fill rates and revenue
- Maintain transparency in the bidding process
- Integrate seamlessly with existing Prebid setups

## How TAM Works

### TAM Integration Flow

1. **TAM Initialization** - Load and initialize the TAM library
2. **Slot Registration** - Register ad slots with TAM
3. **Bid Request** - Request bids from Amazon's demand sources
4. **Bid Response** - Receive and process TAM bids
5. **Auction Integration** - Include TAM bids in your ad auction

### TAM vs Prebid

- **TAM** - Amazon's proprietary header bidding solution
- **Prebid** - Open-source header bidding framework
- **Integration** - Both can work together in the same auction

## Basic Configuration

### Enable TAM

Enable TAM in your Moli configuration:

```ts
const moliConfig: Moli.MoliConfig = {
  slots: [ /* ... */ ],
  // highlight-start
  a9: {
    pubID: 'your-publisher-id',
    timeout: 1000,
    cmpTimeout: 1000
  }
  // highlight-end
};
```

### TAM Slot Configuration

Configure TAM for specific ad slots:

```ts
const slot: Moli.AdSlot = {
  domId: 'content_1',
  adUnitPath: '/1234/content_1',
  sizes: [[300, 250], [728, 90]],
  position: 'in-page',
  behaviour: { loaded: 'eager' },
  
  // highlight-start
  a9: {
    mediaType: 'display', // optional, default is display
    labelAll: ['mobile'] // optional
  }
  // highlight-end
};
```

## Advanced TAM Configuration

### Publisher Configuration

Configure TAM with publisher-specific settings:

```ts
const moliConfig: Moli.MoliConfig = {
  slots: [ /* ... */ ],
  // highlight-start
  a9: {
    pubID: 'your-publisher-id',
    scriptUrl: 'https://c.amazon-adsystem.com/aax2/apstag.js',
    timeout: 1000,
    cmpTimeout: 1000,
    enableFloorPrices: true,
    floorPriceCurrency: 'EUR',
    supportedSizes: [[300, 250], [728, 90], [970, 250]],
    publisherAudience: {
      enabled: true,
      audienceId: 'your-audience-id'
    },
    // this changes the ad unit path length sent to Amazon TAM
    slotNamePathDepth: 2
  }
  // highlight-end
};
```

### Slot Name Path Depth

Amazon TAM uses the ad unit path as a slot identifier. Depending on the depth of your ad slot hierarchy, this can be a bit
too granular for Amazon TAM. The `slotNamePathDepth` setting controls the number of segments that should be included.

Configure the maximum depth for slot name paths:

```ts
a9: {
  pubID: 'your-publisher-id',
  timeout: 1000,
  cmpTimeout: 1000,
  // highlight-start
  slotNamePathDepth: 3 // Maximum depth for slot name paths
  // highlight-end
}
```

Example:

Ad slot path is `/1234/my-site/content_1/mobile/native`
This would be cut to `/1234/my-site/content_1`. The first three segments are `1234`, `my-site` and `content_1`.

### Slot-Level Configuration

Configure detailed TAM settings for each slot:

```ts
const slot: Moli.AdSlot = {
  domId: 'content_1',
  adUnitPath: '/1234/content_1',
  sizes: [[300, 250], [728, 90]],
  position: 'in-page',
  behaviour: { loaded: 'eager' },
  
  // highlight-start
  a9: {
    labelAll: ['content', 'premium'],
    mediaType: 'display',
    slotNamePathDepth: 3
  }
  // highlight-end
};
```

#### Label Filtering

Filter ad slots based on labels:

```ts
const slot: Moli.AdSlot = {
  domId: 'content_1',
  adUnitPath: '/1234/content_1',
  sizes: [[300, 250]],
  position: 'in-page',
  behaviour: { loaded: 'eager' },
  
  a9: {
    labelAll: ['content', 'premium'], // Must have ALL these labels
    labelAny: ['mobile', 'desktop']   // Must have ANY of these labels
  }
};
```

#### Media Type

Specify the media type for the slot:

```ts
const slot: Moli.AdSlot = {
  domId: 'video_1',
  adUnitPath: '/1234/video_1',
  sizes: [[300, 250]],
  position: 'in-page',
  behaviour: { loaded: 'eager' },
  
  a9: {
    mediaType: 'video' // 'display' or 'video'
  }
};
```

#### Slot Name Path Depth Override

Override the global slot name path depth for specific slots:

```ts
const slot: Moli.AdSlot = {
  domId: 'content_1',
  adUnitPath: '/1234/content_1',
  sizes: [[300, 250]],
  position: 'in-page',
  behaviour: { loaded: 'eager' },
  
  a9: {
    slotNamePathDepth: 3 // Override global setting for this slot
  }
};
```

## TAM with Prebid Integration

### Combined Header Bidding

Use TAM alongside Prebid for maximum competition:

```ts
const slot: Moli.AdSlot = {
  domId: 'content_1',
  adUnitPath: '/1234/content_1',
  sizes: [[300, 250], [728, 90]],
  position: 'in-page',
  behaviour: { loaded: 'eager' },
  
  // highlight-start
  // TAM configuration
  a9: {
    labelAll: ['content'],
    mediaType: 'display'
  },
  
  // Prebid configuration
  prebid: {
    adUnit: {
      mediaTypes: {
        banner: { sizes: [[300, 250], [728, 90]] }
      },
      bids: [
        { bidder: 'appNexus', params: { placementId: 123 } },
        { bidder: 'criteo', params: { networkId: 456 } }
      ]
    }
  }
  // highlight-end
};
```

## TAM Configuration Options

### Publisher ID

The `pubID` is your Amazon Publisher ID:

```ts
a9: {
  pubID: 'your-publisher-id', // Required
}
```

### Script URL

Customize the TAM script URL (optional):

```ts
a9: {
  pubID: 'your-publisher-id',
  scriptUrl: 'https://c.amazon-adsystem.com/aax2/apstag.js', // Default
  timeout: 1000,
  cmpTimeout: 1000
}
```

### Timeouts

Configure bid and CMP timeouts:

```ts
a9: {
  pubID: 'your-publisher-id',
  timeout: 1000, // Bid timeout in milliseconds
  cmpTimeout: 1000 // CMP consent timeout in milliseconds
}
```

### Floor Prices

Enable floor price support:

```ts
a9: {
  pubID: 'your-publisher-id',
  timeout: 1000,
  cmpTimeout: 1000,
  enableFloorPrices: true, // Enable floor price support
  floorPriceCurrency: 'EUR' // Floor price currency
}
```

Not that prebid's currency module is used for floor price currency conversion as Amazon TAM has not been able to support different currencies than USD.

### Supported Sizes

Specify which ad sizes to request from TAM:

```ts
a9: {
  pubID: 'your-publisher-id',
  timeout: 1000,
  cmpTimeout: 1000,
  // highlight-end
  supportedSizes: [[300, 250], [728, 90], [970, 250]] // Only request these sizes
  // highlight-end
}
```

This is useful if you have none standard sizes, which are typcially ignored by Amazon TAM.

### Publisher Audiences

Configure Amazon Publisher Audiences:

```ts
a9: {
  pubID: 'your-publisher-id',
  timeout: 1000,
  cmpTimeout: 1000,
  publisherAudience: {
    enabled: true,
    audienceId: 'your-audience-id'
  }
}
```

## TAM Monitoring

### Debug Console

Use the debug console to monitor TAM behavior:

```ts
// Enable debug mode
localStorage.setItem('moliDebug', 'true');

// Open debug console
window.moli.openConsole();

// Monitor TAM events in the console
```

### Network Monitoring

Monitor TAM requests in browser developer tools:

```ts
// Check network tab for TAM requests
// Look for requests to Amazon TAM endpoints
// Monitor bid responses and performance
```

## TAM Testing

### Test Mode Configuration

```ts
const moliConfig: Moli.MoliConfig = {
  environment: 'test',
  slots: [ /* ... */ ],
  a9: {
    pubID: 'test-publisher-id', // Use test publisher ID
    timeout: 1000,
    cmpTimeout: 1000
  }
};
```

### Debug TAM Integration

```ts
// Enable debug mode
localStorage.setItem('moliDebug', 'true');

// Open debug console
window.moli.openConsole();

// Monitor TAM integration in the console
```

## TAM Best Practices

### Appropriate Timeouts

```ts
// ✅ Good - Reasonable timeouts
a9: {
  timeout: 1000, // 1 second bid timeout
  cmpTimeout: 1000 // 1 second CMP timeout
}

// ❌ Avoid - Too aggressive timeouts
a9: {
  timeout: 100, // Too short
  cmpTimeout: 100 // Too short
}
```

### Label Strategy

```ts
// ✅ Good - Logical label filtering
a9: {
  labelAll: ['content'],
  labelAny: ['mobile', 'desktop']
}

// ❌ Avoid - Too restrictive labels
a9: {
  labelAll: ['content', 'premium', 'featured', 'sponsored', 'exclusive'] // Too many required labels
}
```

### Size Configuration

```ts
// ✅ Good - Appropriate size selection
a9: {
  supportedSizes: [[300, 250], [728, 90], [970, 250]] // Common sizes
}

// ❌ Avoid - Too many sizes
a9: {
  supportedSizes: [[300, 250], [320, 50], [320, 100], [728, 90], [970, 90], [970, 250], [970, 66], [970, 415]] // Too many sizes
}
```

## API Reference

TAM (Transparent Ad Marketplace) functionality in Moli is configured through the `a9` property in `MoliConfig` and `AdSlot` configurations. There are no direct TAM methods in the MoliTag interface.

For detailed API documentation, see the [MoliTag API reference](/api/types/moliRuntime/namespaces/MoliRuntime/interfaces/MoliTag).

### Configuration Notes

- **pubID**: Your Amazon Publisher ID (required)
- **timeout**: Bid request timeout in milliseconds
- **cmpTimeout**: Consent Management Platform timeout in milliseconds
- **enableFloorPrices**: Enable yield optimization floor price support
- **floorPriceCurrency**: Currency for floor prices (e.g., 'EUR', 'USD')
- **supportedSizes**: Array of ad sizes to request from TAM
- **labelAll/labelAny**: Filter slots based on labels
- **mediaType**: Specify 'display' or 'video' media type
- **slotNamePathDepth**: Maximum depth for slot name paths

TAM integration is configured through the configuration objects and handled automatically by the ad tag.
