---
title: Getting Started with highfivve
---

This guide will help you get started with Moli ad tag integration. You'll learn how to set up Moli on your website, configure ad slots, and make your first ad requests.

## Prerequisites

Before you begin, make sure you have:

- A Google Ad Manager account
- Access to your website's HTML and JavaScript
- Basic knowledge of HTML, CSS, and JavaScript
- Your Moli configuration from Highfivve

## Quick Start

### 1. Add the Moli Script

Add the Moli script to your HTML page. This script contains your pre-configured ad tag:

```html
<!DOCTYPE html>
<html>
<head>
    <title>My Website</title>
</head>
<body>
    <!-- Your website content -->
    
    <!-- Add the Moli script -->
    <script src="https://cdn.h5v.eu/publishers/[publisher-name]/assets/production/adtag.mjs" data-publisher-code="[publisher-name]" data-version="production" id="moli-ad-tag" async></script>

</body>
</html>
```

Replace `[publisher-name]` with your actual values from Highfivve.

### 2. Add Ad Slot Containers

Add HTML containers for your ad slots:

```html
<body>
    <!-- Header ad slot -->
    <div id="header-ad"></div>
    
    <!-- Content area -->
    <main>
        <h1>Welcome to My Website</h1>
        <p>Your content here...</p>
        
        <!-- In-content ad slot -->
        <div id="content-ad"></div>
        
        <p>More content...</p>
    </main>
    
    <!-- Sidebar ad slot -->
    <aside>
        <div id="sidebar-ad"></div>
    </aside>
    
    <!-- Footer ad slot -->
    <div id="footer-ad"></div>
</body>
```

### 3. Initialize Moli

:::info

You will get a personalized onboarding documentation. Depending on your setup, you may requests ads on your own.
This can be the case if

- you provide additional targeting parameters
- have a single page application

:::

If you need to call `requestAds()`, we call this *Publisher Mode*. Initialize Moli and request ads:

```html
<script>
// Initialize the command queue
window.moli = window.moli || { que: [] };

// Add your initialization code
window.moli.que.push(function(moliAdTag) {
    // Request ads
    moliAdTag.requestAds();
});
</script>
```

If ads are loaded immediatly after the ad tag has loaded, we call this *Instant Mode*.

### 4. Test Your Integration

Open your website and check the browser console for any errors. You should see ad requests being made and ads appearing in your containers.

## Basic Configuration

### Automatic Mode (Recommended for Beginners)

For automatic ad loading, use the `instant` mode:

```html
<script>
window.moli = window.moli || { que: [] };
window.moli.que.push(function(moliAdTag) {
    // Ads will load automatically
    // No additional configuration needed
});
</script>
```

### Manual Mode (For More Control)

For manual control over when ads load:

```html
<script>
window.moli = window.moli || { que: [] };
window.moli.que.push(function(moliAdTag) {
    // Add custom targeting
    moliAdTag.setTargeting('page_type', 'homepage');
    moliAdTag.addLabel('premium');
    
    // Request ads when ready
    moliAdTag.requestAds();
});
</script>
```

## Adding Dynamic Targeting

### Page-Specific Targeting

Add targeting based on your page content:

```ts
window.moli.que.push(function(moliAdTag) {
    // Add page-specific targeting
    moliAdTag.setTargeting('page_type', getPageType());
    moliAdTag.setTargeting('content_category', getContentCategory());
    moliAdTag.setTargeting('user_segment', getUserSegment());
    
    // Add labels
    moliAdTag.addLabel('mobile');
    moliAdTag.addLabel('premium-user');
    
    moliAdTag.requestAds();
});
```

### User-Specific Targeting

Target based on user behavior or preferences:

```ts
window.moli.que.push(function(moliAdTag) {
    // Add user-specific targeting
    if (isLoggedIn()) {
        moliAdTag.setTargeting('user_type', 'logged_in');
        moliAdTag.addLabel('authenticated');
    }
    
    if (isPremiumUser()) {
        moliAdTag.setTargeting('subscription', 'premium');
        moliAdTag.addLabel('premium');
    }
    
    moliAdTag.requestAds();
});
```

## Responsive Design

### Basic Responsive Setup

Moli automatically handles responsive ads based on your configuration:

```html
<!-- Your ad containers will automatically show the right ad sizes -->
<div id="header-ad"></div>
<div id="content-ad"></div>
<div id="sidebar-ad"></div>
```

### Custom Responsive Behavior

For custom responsive behavior, use media queries:

```css
/* Hide sidebar ads on mobile */
@media (max-width: 768px) {
    #sidebar-ad {
        display: none;
    }
}

/* Adjust ad container sizes */
#header-ad {
    width: 100%;
    height: 90px;
}

@media (min-width: 768px) {
    #header-ad {
        height: 250px;
    }
}
```

## Single Page Applications

### Basic SPA Setup

For single page applications, you need to handle page navigation:

```ts
// Initialize Moli
window.moli = window.moli || { que: [] };
window.moli.que.push(function(moliAdTag) {
    moliAdTag.requestAds();
});

// Handle route changes (example with React Router)
function handleRouteChange() {
    window.moli.que.push(function(moliAdTag) {
        // Update targeting for new page
        moliAdTag.setTargeting('page_url', window.location.href);
        moliAdTag.setTargeting('page_title', document.title);
        
        // Request ads for new page
        moliAdTag.requestAds();
    });
}
```

### React Component Example

```tsx
import React, { useEffect } from 'react';

const AdSlot = ({ id, className }) => {
    useEffect(() => {
        // Refresh ad slot when component mounts
        window.moli.que.push(function(moliAdTag) {
            moliAdTag.refreshAdSlot(id);
        });
    }, [id]);

    return <div id={id} className={className} />;
};

// Usage
<AdSlot id="header-ad" className="ad-container" />
```

## Debugging

### Enable Debug Mode

Enable debug mode to see detailed logs:

```ts
window.moli.que.push(function(moliAdTag) {
    // Enable debug mode
    moliAdTag.openConsole();
    
    moliAdTag.requestAds();
});
```

Or add the debug parameter to your URL:

```
https://yoursite.com?moliDebug=true
```

### Common Issues

**Ads not loading:**

- Check that the Moli script is loaded
- Verify your ad slot IDs match your configuration
- Check the browser console for errors

**Wrong ad sizes:**

- Verify your responsive configuration
- Check that your CSS isn't overriding ad container sizes
- Ensure your device detection is working

**Targeting not working:**

- Verify targeting keys and values are correct
- Check that targeting is set before `requestAds()` is called
- Use the debug console to inspect targeting values

## Best Practices

### Performance

1. **Load scripts asynchronously:**

```html
<script src="https://[publisher-name].h5v.eu/[version]/moli_[hash].js" async></script>
<script src="https://www.googletagservices.com/tag/js/gpt.js" async></script>
```

2. **Set targeting early:**

```ts
window.moli.que.push(function(moliAdTag) {
    // Set targeting before requesting ads
    moliAdTag.setTargeting('key', 'value');
    moliAdTag.addLabel('label');
    
    moliAdTag.requestAds();
});
```

3. **Use lazy loading for below-the-fold ads:**

```ts
// Only load ads when they're about to be visible
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            window.moli.que.push(function(moliAdTag) {
                moliAdTag.refreshAdSlot(entry.target.id);
            });
        }
    });
});

document.querySelectorAll('.lazy-ad').forEach(ad => {
    observer.observe(ad);
});
```

### User Experience

1. **Reserve space for ads:**

```css
.ad-container {
    min-height: 250px; /* Reserve space for ad */
    background: #f0f0f0; /* Placeholder background */
}
```

2. **Handle ad loading states:**

```ts
window.moli.que.push(function(moliAdTag) {
    moliAdTag.addEventListener('afterRequestAds', (event) => {
        if (event.state === 'finished') {
            // Hide loading indicators
            document.querySelectorAll('.ad-loading').forEach(el => {
                el.style.display = 'none';
            });
        }
    });
    
    moliAdTag.requestAds();
});
```

3. **Respect user preferences:**

```ts
// Check if user has opted out of ads
if (!userHasOptedOut()) {
    window.moli.que.push(function(moliAdTag) {
        moliAdTag.requestAds();
    });
}
```

## Next Steps

Now that you have the basics working, explore these advanced features:

- [Targeting](/docs/features/targeting) - Learn about advanced targeting options
- [Hooks](/docs/features/hooks) - Use hooks for custom behavior
- [Events](/docs/features/events) - Listen to ad loading events
- [Single Page Applications](/docs/features/single-page-app) - Advanced SPA integration
- [Debugging](/docs/features/debugging) - Debug and troubleshoot issues

## Support

If you need help:

1. Check the [API Reference](/api) for detailed documentation
2. Use the debug console to inspect your configuration
3. Contact Highfivve support for configuration issues
4. Check the browser console for error messages
