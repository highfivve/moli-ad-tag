---
title: Performance Optimization
---

This guide covers performance optimization techniques for Moli ad tag integration. Learn how to minimize the impact of ads on your website's performance while maximizing revenue.

## Overview

Ad tags can significantly impact website performance. This guide provides strategies to:

- Minimize page load time impact
- Optimize ad loading and rendering
- Reduce layout shifts
- Improve Core Web Vitals
- Maximize ad viewability and revenue

## Script Loading Optimization

### Asynchronous Loading

Always load Moli scripts asynchronously to prevent blocking page rendering:

```html
<!-- ✅ Good - Asynchronous loading -->
<script src="https://[publisher-name].h5v.eu/[version]/moli_[hash].js" async></script>
<script src="https://www.googletagservices.com/tag/js/gpt.js" async></script>

<!-- ❌ Avoid - Synchronous loading -->
<script src="https://[publisher-name].h5v.eu/[version]/moli_[hash].js"></script>
<script src="https://www.googletagservices.com/tag/js/gpt.js"></script>
```

### Preload Critical Resources

Preload critical ad resources for better performance:

```html
<head>
  <!-- Preload critical ad resources -->
  <link rel="preload" href="https://[publisher-name].h5v.eu/[version]/moli_[hash].js" as="script">
  <link rel="preload" href="https://www.googletagservices.com/tag/js/gpt.js" as="script">
  
  <!-- Preconnect to ad domains -->
  <link rel="preconnect" href="https://securepubads.g.doubleclick.net">
  <link rel="preconnect" href="https://www.googletagservices.com">
  <link rel="preconnect" href="https://[publisher-name].h5v.eu">
</head>
```

### DNS Prefetching

Prefetch DNS for ad-related domains:

```html
<head>
  <!-- DNS prefetch for ad domains -->
  <link rel="dns-prefetch" href="//securepubads.g.doubleclick.net">
  <link rel="dns-prefetch" href="//www.googletagservices.com">
  <link rel="dns-prefetch" href="//[publisher-name].h5v.eu">
  <link rel="dns-prefetch" href="//prebid.a-mo.net">
  <link rel="dns-prefetch" href="//aax.amazon-adsystem.com">
</head>
```

## Ad Slot Optimization

### Reserve Space for Ads

Reserve space for ads to prevent layout shifts:

```css
/* Reserve space for common ad sizes */
.ad-container {
  min-height: 250px; /* Reserve space for 300x250 */
  background: #f0f0f0; /* Placeholder background */
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Responsive ad containers */
.header-ad {
  min-height: 90px; /* Mobile */
}

@media (min-width: 768px) {
  .header-ad {
    min-height: 250px; /* Desktop */
  }
}

.sidebar-ad {
  min-height: 600px; /* 300x600 */
}

.content-ad {
  min-height: 250px; /* 300x250 */
}
```

### Use CSS Containment

Use CSS containment to isolate ad rendering:

```css
.ad-container {
  contain: layout style paint;
  min-height: 250px;
  overflow: hidden;
}
```

### Optimize Ad Container Sizing

Use responsive sizing to match ad content:

```css
/* Responsive ad sizing */
.ad-responsive {
  width: 100%;
  height: auto;
  min-height: 250px;
}

/* Specific ad sizes */
.ad-300x250 {
  width: 300px;
  height: 250px;
}

.ad-728x90 {
  width: 728px;
  height: 90px;
}

/* Mobile-first responsive */
@media (max-width: 768px) {
  .ad-728x90 {
    width: 320px;
    height: 50px;
  }
}
```

## Lazy Loading

Lazy loading is a technique to load ad slots when they are about to become visible.
This has a lot of positive effects, like

- lower load during page load as fewer ads are being loaded
- higher viewability for ad slots, as the likelyhood increases the slot is seen by the the user
- higher CPMs and fill rates, due to better viewability metrics

This however comes at a cost. There are now less ad requests being made and thus less opportunities to serve ads.
Make sure to test properly, which strategy works best.

:::note

Slots need to have the loading behaviour `manual` to be loaded manually.
Or you need to refresh them with `refreshAdSlot('id-of-slot', { loaded: 'eager' })`.

:::

### Lazy Loading Module

The [Lazy Load Module](../modules/lazy-load.md) offers various configuration options to make a slot lazy.

### React Lazy Loading Component

```tsx
import React, { useEffect, useRef, useState } from 'react';

interface LazyAdSlotProps {
  id: string;
  className?: string;
  threshold?: number;
  rootMargin?: string;
}

const LazyAdSlot: React.FC<LazyAdSlotProps> = ({ 
  id, 
  className, 
  threshold = 0.1, 
  rootMargin = '50px' 
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isLoaded) {
          setIsVisible(true);
          setIsLoaded(true);
          
          // Load the ad
          window.moli.que.push(function(moliAdTag) {
            moliAdTag.refreshAdSlot(id);
          });
        }
      },
      { threshold, rootMargin }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [id, isLoaded, threshold, rootMargin]);

  return (
    <div ref={ref} className={className}>
      {isVisible && <div id={id} />}
      {!isVisible && (
        <div className="ad-placeholder">
          <div className="loading-spinner" />
        </div>
      )}
    </div>
  );
};

export default LazyAdSlot;
```

## Timing Optimization

### Delay Non-Critical Ads

Delay loading of below-the-fold ads:

```ts
// Delay loading of non-critical ads
const loadAdsWithDelay = () => {
  // Load above-the-fold ads immediately
  const aboveFoldAds = ['header-ad', 'top-content-ad'];
  
  aboveFoldAds.forEach(adId => {
    window.moli.que.push(function(moliAdTag) {
      moliAdTag.refreshAdSlot(adId);
    });
  });
  
  // Delay below-the-fold ads
  setTimeout(() => {
    const belowFoldAds = ['sidebar-ad', 'footer-ad', 'bottom-content-ad'];
    
    belowFoldAds.forEach(adId => {
      window.moli.que.push(function(moliAdTag) {
        moliAdTag.refreshAdSlot(adId);
      });
    });
  }, 2000); // 2 second delay
};
```

### User Interaction Triggers

Load ads on user interaction:

```ts
// Load ads on user interaction
const loadAdsOnInteraction = () => {
  const interactionEvents = ['scroll', 'click', 'touchstart'];
  let hasInteracted = false;
  
  const loadDelayedAds = () => {
    if (hasInteracted) return;
    
    hasInteracted = true;
    
    // Load delayed ads
    const delayedAds = ['sidebar-ad', 'footer-ad'];
    delayedAds.forEach(adId => {
      window.moli.que.push(function(moliAdTag) {
        moliAdTag.refreshAdSlot(adId);
      });
    });
  };
  
  interactionEvents.forEach(event => {
    window.addEventListener(event, loadDelayedAds, { 
      once: true, 
      passive: true 
    });
  });
  
  // Fallback: load after 5 seconds
  setTimeout(loadDelayedAds, 5000);
};
```

## Core Web Vitals Optimization

### Cumulative Layout Shift (CLS)

Minimize layout shifts caused by ads:

```css
/* Prevent layout shifts */
.ad-container {
  /* Reserve space */
  min-height: 250px;
  
  /* Prevent layout shifts */
  contain: layout;
  
  /* Smooth transitions */
  transition: height 0.3s ease;
}

/* Hide ads until loaded */
.ad-container:empty {
  display: none;
}

/* Show ads when content is ready */
.ad-container:not(:empty) {
  display: block;
}
```

### First Input Delay (FID)

Minimize impact on user interactions:

```ts
// Optimize for FID
const optimizeFID = () => {
  // Use requestIdleCallback for non-critical operations
  requestIdleCallback(() => {
    window.moli.que.push(function(moliAdTag) {
      // Set up targeting and request ads
      moliAdTag.setTargeting('page_type', getPageType());
      moliAdTag.requestAds();
    });
  });
};
```

## Best Practices Summary

### 1. Script Loading

- Load scripts asynchronously
- Use preload and preconnect
- DNS prefetch ad domains

### 2. Ad Slot Management

- Reserve space for ads
- Use CSS containment
- Implement lazy loading

### 3. Timing Optimization

- Delay non-critical ads
- Use user interaction triggers
- Batch ad requests

### 4. Performance Monitoring

- Monitor Core Web Vitals
- Track ad performance
- Optimize based on metrics

## Tools and Resources

### Performance Testing Tools

- [Google PageSpeed Insights](https://pagespeed.web.dev/)
- [WebPageTest](https://www.webpagetest.org/)
- [Lighthouse](https://developers.google.com/web/tools/lighthouse)

### Monitoring Tools

- [Google Analytics](https://analytics.google.com/)
- [New Relic](https://newrelic.com/)
- [DataDog](https://www.datadoghq.com/)

### Browser DevTools

- Performance tab for timing analysis
- Network tab for request optimization
- Memory tab for leak detection
