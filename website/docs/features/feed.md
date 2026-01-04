---
title: Feeds
---

# Feed Module

The feed module allows you to load arbitrary HTML content into a specific container on your page. Primary use cases include "smart feeds" or recommendation widgets, but it can be used for any dynamic content injection.

## Use Cases
- Displaying personalized or contextual recommendation widgets.
- Integrating third-party content feeds (e.g., news, products, social widgets).
- Loading custom HTML into containers based on page context or user segments.

Custom keywords can be attached to each feed option for more granular targeting.

## Configuration and Integration

To enable the feed module, add a `feed` section to your modules config:

```json
{
  "feed": {
    "enabled": true,
    "feeds": [
      {
        "selector": ".feed-container",
        "feedUrl": "https://api.example.com/feed",
        "keywords": ["sports", "news"],
        "labels": ["desktop", "homepage"]
      }
    ]
  }
}
```

- `selector`: CSS selector for the container(s) to inject content into.
- `feedUrl`: The endpoint returning HTML to inject.
- `keywords`: (Optional) Array of keywords sent to the feed API for targeting.
- `labels`: (Optional) Conditional labels to control when the feed is active.

Feeds are only injected if their labels match the current context, making it easy to enable or disable feeds dynamically.

## How it Works
- On initialization, the module fetches content for each configured feed and injects it into the matching container(s).
- Any `<script>` tags in the injected HTML are re-executed for full widget compatibility.
- Label-based filtering ensures feeds are only active in the right context.

For more on label configuration, see [Labels](./labels.md).
