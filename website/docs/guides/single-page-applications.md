---
title: Single Page Applications
---

This guide covers how to integrate Moli with single page applications (SPAs) built with frameworks like React, Vue, Angular, or vanilla JavaScript. SPAs require special handling because they don't trigger full page reloads when users navigate.

## Overview

SPAs present unique challenges for ad tags:

- No page reloads mean ads don't automatically refresh
- Route changes need to trigger new ad requests
- Ad slots may be dynamically created and destroyed
- State management becomes more complex

Moli provides built-in SPA support to handle these challenges.

## Basic SPA Setup

:::warning

A lot of the examples are generated with AI and have not been tested in production.
Take extra care in handling state management and check that ad slots are rendered only once.

:::

### 1. Enable SPA Mode

Configure Moli for SPA mode in your configuration:

```ts
const moliConfig = {
  // ... other configuration
  spa: {
    enabled: true,
    validateLocation: 'href' // or 'pathname' or 'none'
  }
};
```

### 2. Initialize Moli

Set up Moli with SPA support:

```ts
// Initialize Moli
window.moli = window.moli || { que: [] };
window.moli.que.push(function(moliAdTag) {
  // Initial ad request
  moliAdTag.requestAds();
});
```

### 3. Handle Route Changes

Trigger new ad requests when routes change:

```ts
// Example with React Router
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

function App() {
  const location = useLocation();

  useEffect(() => {
    // Request ads on route change
    window.moli.que.push(function(moliAdTag) {
      moliAdTag.requestAds();
    });
  }, [location]);

  return (
    <div>
      {/* Your app content */}
    </div>
  );
}
```

## Route Change Detection

### validateLocation Options

The `validateLocation` setting determines what constitutes a route change:

```ts
const moliConfig = {
  spa: {
    enabled: true,
    validateLocation: 'href' // Options: 'href', 'pathname', 'none'
  }
};
```

- **`'href'`** (default) - Full URL changes trigger new ad requests
- **`'pathname'** - Only path changes trigger new ad requests (ignores query params and hash)
- **`'none'** - No automatic detection (manual control only)

### Manual Route Change Handling

For frameworks without built-in route change detection:

```ts
// Custom route change handler
function handleRouteChange(newUrl) {
  // Update browser history
  window.history.pushState({}, '', newUrl);
  
  // Trigger ad request
  window.moli.que.push(function(moliAdTag) {
    moliAdTag.requestAds();
  });
}

// Listen for browser back/forward
window.addEventListener('popstate', () => {
  window.moli.que.push(function(moliAdTag) {
    moliAdTag.requestAds();
  });
});
```

## Framework-Specific Integration

### React

#### Basic React Integration

```tsx
import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

function App() {
  const location = useLocation();

  useEffect(() => {
    // Initialize Moli on first load
    if (!window.moli) {
      window.moli = { que: [] };
      window.moli.que.push(function(moliAdTag) {
        moliAdTag.requestAds();
      });
    } else {
      // Request ads on route change
      window.moli.que.push(function(moliAdTag) {
        moliAdTag.requestAds();
      });
    }
  }, [location]);

  return (
    <div>
      <Header />
      <main>
        <Routes />
      </main>
      <Footer />
    </div>
  );
}
```

#### Ad Slot Component

This is a minimal example of an `AdSlot` component in React.

```tsx
import React, { useEffect, useRef } from 'react';

interface AdSlotProps {
  id: string;
  className?: string;
  style?: React.CSSProperties;
}

const AdSlot: React.FC<AdSlotProps> = ({ id, className, style }) => {
  const adRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Refresh ad slot when component mounts
    window.moli.que.push(function(moliAdTag) {
      moliAdTag.refreshAdSlot(id);
    });

    // Cleanup when component unmounts
    return () => {
      // Optional: Clean up ad slot. This is usually done by the ad tag itself on requestAds()
      if (adRef.current) {
        adRef.current.innerHTML = '';
      }
    };
  }, [id]);

  return (
    <div
      ref={adRef}
      id={id}
      className={className}
      style={style}
    />
  );
};

export default AdSlot;
```

#### Usage in Components

```tsx
function HomePage() {
  return (
    <div>
      <h1>Welcome to Our Site</h1>
      <AdSlot id="header-ad" className="ad-container" />
      
      <main>
        <p>Content here...</p>
        <AdSlot id="content-ad" className="ad-container" />
        <p>More content...</p>
      </main>
      
      <AdSlot id="sidebar-ad" className="ad-container" />
    </div>
  );
}
```

### Vue.js

#### Vue 3 Composition API

```vue
<template>
  <div>
    <header>
      <AdSlot id="header-ad" />
    </header>
    
    <main>
      <router-view />
    </main>
    
    <footer>
      <AdSlot id="footer-ad" />
    </footer>
  </div>
</template>

<script setup>
import { onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import AdSlot from './components/AdSlot.vue';

const route = useRoute();

// Initialize Moli
onMounted(() => {
  window.moli = window.moli || { que: [] };
  window.moli.que.push(function(moliAdTag) {
    moliAdTag.requestAds();
  });
});

// Handle route changes
watch(() => route.path, () => {
  window.moli.que.push(function(moliAdTag) {
    moliAdTag.requestAds();
  });
});
</script>
```

#### Ad Slot Component

```vue
<template>
  <div :id="id" :class="className" :style="style"></div>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue';

const props = defineProps({
  id: {
    type: String,
    required: true
  },
  className: {
    type: String,
    default: ''
  },
  style: {
    type: Object,
    default: () => ({})
  }
});

onMounted(() => {
  window.moli.que.push(function(moliAdTag) {
    moliAdTag.refreshAdSlot(props.id);
  });
});

onUnmounted(() => {
  // Optional cleanup
  const element = document.getElementById(props.id);
  if (element) {
    element.innerHTML = '';
  }
});
</script>
```

### Angular

#### Angular Service

```typescript
import { Injectable } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class MoliService {
  constructor(private router: Router) {
    this.initializeMoli();
    this.handleRouteChanges();
  }

  private initializeMoli(): void {
    (window as any).moli = (window as any).moli || { que: [] };
    (window as any).moli.que.push((moliAdTag: any) => {
      moliAdTag.requestAds();
    });
  }

  private handleRouteChanges(): void {
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        (window as any).moli.que.push((moliAdTag: any) => {
          moliAdTag.requestAds();
        });
      });
  }

  refreshAdSlot(id: string): void {
    (window as any).moli.que.push((moliAdTag: any) => {
      moliAdTag.refreshAdSlot(id);
    });
  }
}
```

#### Ad Slot Component

```typescript
import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { MoliService } from '../services/moli.service';

@Component({
  selector: 'app-ad-slot',
  template: '<div [id]="id" [class]="className" [style]="style"></div>'
})
export class AdSlotComponent implements OnInit, OnDestroy {
  @Input() id!: string;
  @Input() className: string = '';
  @Input() style: any = {};

  constructor(private moliService: MoliService) {}

  ngOnInit(): void {
    this.moliService.refreshAdSlot(this.id);
  }

  ngOnDestroy(): void {
    // Optional cleanup
    const element = document.getElementById(this.id);
    if (element) {
      element.innerHTML = '';
    }
  }
}
```

## Dynamic Ad Slots

### Lazy Loading Ad Slots

Load ad slots only when they're about to be visible:

```tsx
import React, { useEffect, useRef, useState } from 'react';

const LazyAdSlot = ({ id, className }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const ref = useRef(null);

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
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [id, isLoaded]);

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
```

### Conditional Ad Slots

Show/hide ad slots based on conditions:

```tsx
const ConditionalAdSlot = ({ id, show, className }) => {
  useEffect(() => {
    if (show) {
      window.moli.que.push(function(moliAdTag) {
        moliAdTag.refreshAdSlot(id);
      });
    }
  }, [show, id]);

  if (!show) return null;

  return <div id={id} className={className} />;
};

// Usage
<ConditionalAdSlot 
  id="premium-ad" 
  show={isPremiumUser()} 
  className="ad-container" 
/>
```

## State Management

### Targeting Updates

Update targeting for each route:

```tsx
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

function App() {
  const location = useLocation();

  useEffect(() => {
    window.moli.que.push(function(moliAdTag) {
      // Update targeting for new route
      moliAdTag.setTargeting('page_url', location.pathname);
      moliAdTag.setTargeting('page_title', document.title);
      
      // Add route-specific targeting
      if (location.pathname.includes('/sports/')) {
        moliAdTag.setTargeting('section', 'sports');
        moliAdTag.addLabel('sports-content');
      } else if (location.pathname.includes('/news/')) {
        moliAdTag.setTargeting('section', 'news');
        moliAdTag.addLabel('news-content');
      }
      
      moliAdTag.requestAds();
    });
  }, [location]);

  return <Routes />;
}
```

### User State Management

Handle user state changes:

```tsx
const useUserState = () => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Update targeting when user state changes
    window.moli.que.push(function(moliAdTag) {
      if (user) {
        moliAdTag.setTargeting('user_type', user.type);
        moliAdTag.setTargeting('user_id', user.id);
        moliAdTag.addLabel('authenticated');
        
        if (user.isPremium) {
          moliAdTag.addLabel('premium');
        }
      } else {
        moliAdTag.setTargeting('user_type', 'anonymous');
        moliAdTag.addLabel('anonymous');
      }
    });
  }, [user]);

  return { user, setUser };
};
```

## Performance Optimization

### Debounced Route Changes

Prevent excessive ad requests during rapid navigation:

```tsx
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

function App() {
  const location = useLocation();
  const timeoutRef = useRef(null);

  useEffect(() => {
    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Debounce ad requests
    timeoutRef.current = setTimeout(() => {
      window.moli.que.push(function(moliAdTag) {
        moliAdTag.requestAds();
      });
    }, 100); // 100ms delay

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [location]);

  return <Routes />;
}
```

### Ad Slot Caching

Cache ad slots to avoid unnecessary refreshes:

```tsx
const AdSlotCache = new Set();

const CachedAdSlot = ({ id, className }) => {
  useEffect(() => {
    if (!AdSlotCache.has(id)) {
      window.moli.que.push(function(moliAdTag) {
        moliAdTag.refreshAdSlot(id);
      });
      AdSlotCache.add(id);
    }
  }, [id]);

  return <div id={id} className={className} />;
};
```

## Error Handling

### Route Change Errors

Handle errors during route changes:

```tsx
const handleRouteChange = async () => {
  try {
    window.moli.que.push(function(moliAdTag) {
      moliAdTag.requestAds();
    });
  } catch (error) {
    console.error('Failed to request ads on route change:', error);
    // Fallback: retry after delay
    setTimeout(() => {
      window.moli.que.push(function(moliAdTag) {
        moliAdTag.requestAds();
      });
    }, 1000);
  }
};
```

### Ad Loading Errors

Handle ad loading failures:

```tsx
useEffect(() => {
  window.moli.que.push(function(moliAdTag) {
    moliAdTag.addEventListener('afterRequestAds', (event) => {
      if (event.state === 'error') {
        console.error('Ad request failed on route change');
        // Implement fallback behavior
      }
    });
    
    moliAdTag.requestAds();
  });
}, [location]);
```

## Testing

### Unit Testing

Test SPA integration with Jest:

```tsx
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

// Mock Moli
const mockMoliAdTag = {
  requestAds: jest.fn(),
  refreshAdSlot: jest.fn(),
  setTargeting: jest.fn(),
  addLabel: jest.fn()
};

global.window.moli = {
  que: []
};

beforeEach(() => {
  global.window.moli.que = [];
  jest.clearAllMocks();
});

test('requests ads on route change', () => {
  render(
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );

  // Simulate route change
  window.history.pushState({}, '', '/new-route');
  window.dispatchEvent(new PopStateEvent('popstate'));

  // Check that ads were requested
  expect(global.window.moli.que.length).toBeGreaterThan(0);
});
```

### Integration Testing

Test with Cypress:

```javascript
// cypress/integration/spa.spec.js
describe('SPA Integration', () => {
  it('should load ads on route change', () => {
    cy.visit('/');
    
    // Check initial ads
    cy.get('#header-ad').should('be.visible');
    
    // Navigate to new route
    cy.visit('/about');
    
    // Check that ads are refreshed
    cy.get('#header-ad').should('be.visible');
    
    // Verify ad requests were made
    cy.window().then((win) => {
      expect(win.moli.que.length).to.be.greaterThan(0);
    });
  });
});
```

## Best Practices

### 1. Initialize Once

Initialize Moli only once at app startup:

```tsx
// App.tsx
useEffect(() => {
  // Only initialize once
  if (!window.moli) {
    window.moli = { que: [] };
    window.moli.que.push(function(moliAdTag) {
      moliAdTag.requestAds();
    });
  }
}, []); // Empty dependency array
```

### 2. Clean Up Ad Slots

Clean up ad slots when components unmount:

```tsx
useEffect(() => {
  return () => {
    // Clean up ad slot
    const element = document.getElementById(id);
    if (element) {
      element.innerHTML = '';
    }
  };
}, [id]);
```

### 3. Handle Loading States

Show loading states during ad requests:

```tsx
const [adsLoading, setAdsLoading] = useState(false);

useEffect(() => {
  setAdsLoading(true);
  
  window.moli.que.push(function(moliAdTag) {
    moliAdTag.addEventListener('afterRequestAds', (event) => {
      setAdsLoading(false);
    });
    
    moliAdTag.requestAds();
  });
}, [location]);

return (
  <div>
    {adsLoading && <div className="loading-indicator" />}
    <AdSlot id="header-ad" />
  </div>
);
```

### 4. Optimize Performance

Use performance optimizations:

```tsx
// Debounce rapid route changes
const debouncedRequestAds = useMemo(
  () => debounce(() => {
    window.moli.que.push(function(moliAdTag) {
      moliAdTag.requestAds();
    });
  }, 100),
  []
);

useEffect(() => {
  debouncedRequestAds();
}, [location, debouncedRequestAds]);
```

## Troubleshooting

### Common Issues

**Ads not refreshing on route change:**

- Check that SPA mode is enabled in configuration
- Verify route change detection is working
- Ensure `requestAds()` is called on route changes

**Duplicate ad requests:**

- Check for multiple route change listeners
- Verify debouncing is working correctly
- Ensure cleanup is happening properly
- Use the frequency capping module to add frequency caps on ad slots to have a safe guard for double rendering

**Ad slots not appearing:**

- Check that ad slot IDs match configuration
- Verify components are mounting correctly
- Check for CSS conflicts

## Next Steps

Now that you have SPA integration working, explore these advanced topics:

- [Hooks](/docs/features/hooks) - Use hooks for custom SPA behavior
- [Events](/docs/features/events) - Listen to ad loading events
- [Targeting](/docs/features/targeting) - Advanced targeting for SPAs
- [Debugging](/docs/features/debugging) - Debug SPA-specific issues
