---
title: Consent (TCF2)
---

Moli integrates with the [IAB Transparency and Consent Framework 2.0 (TCF2)](https://github.com/InteractiveAdvertisingBureau/GDPR-Transparency-and-Consent-Framework/blob/master/TCFv2/IAB%20Tech%20Lab%20-%20CMP%20API%20v2.md) to ensure compliance with privacy regulations like GDPR. The ad tag automatically handles consent state and only loads ads when appropriate consent is available.

## Overview

TCF2 is a standardized framework that allows publishers to:

- Collect user consent for data processing
- Communicate consent choices to advertising partners
- Ensure compliance with privacy regulations
- Provide transparency about data usage

## How It Works

### 1. Consent Collection

Your Consent Management Platform (CMP) collects user consent and provides it in the `__tcfapi` global API.

### 2. Consent Detection

Moli automatically detects the TCF2 consent state and waits for consent to be ready before loading ads.

### 3. Ad Loading

Ads are only loaded when:

- Consent is available and valid
- The user has given appropriate permissions
- The CMP has signaled that consent is ready

## Configuration

### Basic Setup

Moli automatically integrates with TCF2 without additional configuration.

## Consent States

### Consent Ready

The user has made consent choices and ads can be loaded:

```ts
// Consent is available
window.moli.requestAds(); // ✅ Ads will load
```

### Consent Pending

The user hasn't made consent choices yet:

```ts
// Consent not yet available
window.moli.requestAds(); // ⏳ Will wait for consent
```

### Consent Denied

The user has denied consent for advertising:

```ts
// User denied consent
window.moli.requestAds(); // ❌ Ads won't load
```

## Integration with CMPs

### Popular CMPs

Moli works with any TCF2-compliant CMP, including:

- [Consentmanager](https://consentmanager.net)
- [OneTrust](https://www.onetrust.com/)
- [Quantcast Choice](https://www.quantcast.com/choice/)
- [Sourcepoint](https://www.sourcepoint.com/)
- [Cookiebot](https://www.cookiebot.com/)
- [TrustArc](https://www.trustarc.com/)

### CMP Implementation Example

```html
<!DOCTYPE html>
<html>
<head>
  <!-- CMP Script -->
  <script src="https://cdn.cookielaw.org/consent/your-cmp-id/otSDKStub.js"></script>
  
  <!-- Moli Ad Tag -->
  <script type="module" async src="https://cdn.h5v.eu/adtag/v5.0.3/all.mjs"></script>
</head>
<body>
  <!-- Your content -->
  
  <script>
    window.moli = window.moli || { que: [] };
    window.moli.que.push(function(adTag) {
      adTag.configure({
        slots: [ /* ... */ ],
        consent: {
          waitForConsent: true
        }
      });
    });
  </script>
</body>
</html>
```

## Consent with Prebid

When using Prebid.js, consent is automatically passed to bidders:

```ts
const moliConfig: Moli.MoliConfig = {
  slots: [ /* ... */ ],
  prebid: {
    config: {
      // highlight-start
      consentManagement: {
        // TCF2 is automatically configured
        timeout: 500,
      }
      // highlight-end
    }
  }
};
```

## Testing Consent

### Test Mode

For development and testing, you can bypass consent requirements:

```ts
const moliConfig: Moli.MoliConfig = {
  environment: 'test', // Enables test mode
  slots: [ /* ... */ ],
  consent: {
    waitForConsent: false // Disable consent for testing
  }
};
```

### Debugging Consent

You can always call the `__tcfapi` directly.

```ts
window.__tcfapi("addEventListener", 2, console.log);
```

Here's a small script to check if consent is given for a single vendor and purposes.

```ts
/**
 *
 * @param vendorId the IAB assigned vendor id
 * @param requiredPurposes the IAB purpose IDs 1 to 10
 * @param onConsentCallback invoked when consent is available and granted
 *
 * @see https://github.com/InteractiveAdvertisingBureau/GDPR-Transparency-and-Consent-Framework/blob/master/TCFv2/IAB%20Tech%20Lab%20-%20CMP%20API%20v2.md#gettcdata
 */
function loadWithConsent(vendorId, requiredPurposes, onConsentCallback) {
  if (window.__tcfapi) {
    var listener = (tcData) => {
      if (
        tcData.cmpStatus !== "error" && (
          tcData.eventStatus === "useractioncomplete" ||
          tcData.eventStatus === "tcloaded"
        )
      ) {
        // check if consent is required and if the user has given it
        if (
          // gdpr does not apply, so we can always invoke 3rd party code
          !tcData.gdprApplies ||
          // check the specific vendor for consent
          (!!tcData.vendor.consents[vendorId] &&
            // check all required purposes for the vendor
            requiredPurposes.every(function(purposeId) {
              return !!tcData.purpose.consents[purposeId];
            })
          )
        ) {
          onConsentCallback();
        }

        // remove listener if consent is available
        if (tcData.listenerId) {
          window.__tcfapi("removeEventListener", 2, function() {
          }, tcData.listenerId);
        }
      }
    };
    window.__tcfapi("addEventListener", 2, listener);
  }
}
```

## Privacy Compliance

### GDPR Compliance

Moli's TCF2 integration helps ensure GDPR compliance by:

- Only loading ads with proper consent
- Respecting user privacy choices

## API Reference

Consent management in Moli is handled through TCF2 integration and Prebid.js configuration. There are no direct consent methods in the MoliTag interface.

For detailed API documentation, see the [MoliTag API reference](/api/types/moliRuntime/namespaces/MoliRuntime/interfaces/MoliTag).

### Consent Configuration

Consent is configured through the `consent` property in `MoliConfig` and `consentManagement` in Prebid configuration.
