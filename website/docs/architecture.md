---
title: Architecture
---

This section describes the conceptual architecture of the ad tag.

## Ad Service & Ad Pipeline

[AdPipeline API](api/classes/AdPipeline)


```
┌────AdService───────────────────────────────────────────────────────────────┐
│                                                                            │
│                                                                            │
│ ┌──────────────────┐                                                       │
│ │ AdPipelineContext│        ┌────────┐     ┌──────────────┐                │
│ │                  │ ─────► │(1)init ├───► │ (2)configure │ ──────┐        │
│ │ Moli.AdSlot[]    │        └────────┘     └──────────────┘       │        │
│ └──────────────────┘                                              │        │
│                                                                   ▼        │
│                                                        ┌───────────────┐   │
│         ┌─────────────────┐                            │(3)define slots│   │
│     ┌─► │ (6)request ads  │                            └──────────┬────┘   │
│     │   └─────────────────┘                                       │        │
│     │                                                             │        │
│     │   ┌─────────────────┐       ┌───────────────────────┐       │        │
│     └── │ (5)request bids │ ◄─────┤(4)prepare request ads │◄──────┘        │
│         └─────────────────┘       └───────────────────────┘                │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### Ad Pipeline Context

### Init

Use cases

- domReady
- gpt ready
- prebid ready
- a9 fetch js
- async fetching of external resources

### Configure

Use cases

- gpt configuration
- prebid configuration
- a9 configuration


### Define slots

Create slot definitions

- [define google ad slots](https://developers.google.com/publisher-tag/reference#googletag.defineSlot)
- filter sizes

### Prepare Request Ads

This phase configures external systems such as prebid and a9 or and prepares
the existing google ad slots for a request.

- add prebid ad units
- add a9 ad units
- yield optimization
- remove stale prebid / a9 key-values

### Request Bids

Make calls to 3rd party systems to fetch bids.
This is the last step where we can perform actions on slot definitions before we hit google ad manager.

- prebid requestBids / setGptTargeting
- a9 fetchBids

### Request Ads

Fire googletag ad request.

## Moli State Machine

See [moli typescript docs](api/namespaces/Moli.state)

```
                                                                                  setXYZ / addXYZ
                                                                                  requestAds()

                                                                                  ┌──────────┐
                                                                                  │          │
                                                                                  │          │
                                                                                  │          ▼
                                                                                  │
                                        ┌────────────┐     requestAds()     ┌─────┴─────────────────────────┐
                                        │            │                      │                               │
                                        │ configured │  ─────────────────►  │ Single Page App               │
                                        │            │                      │ spa-requestAds / spa-finished │
                                        └────────────┘                      └───────────────────────────────┘

                                              ▲
                                              │
                                              │  enableSinglePageApp()
                                              │                                        ads ok        ┌──────────┐
                                              │                                                      │          │
                                              │                                     ┌────────────►   │ finished │
                                              │                                     │                │          │
                                                                                    │                └──────────┘
┌──────────────┐    configure(config)   ┌────────────┐      requestAds()     ┌──────┴─────┐
│              │                        │            │                       │            │
│ configureable│  ────────────────────► │ configured │  ──────────────────►  │ requestAds │
│              │                        │            │                       │            │
└──────────────┘                        └────────────┘                       └──────┬─────┘
                                                                                    │                ┌──────────┐
  │         ▲                            │         ▲                                │                │          │
  │         │                            │         │                                └─────────────►  │ error    │
  └► setXYZ─┘                            └► setXYZ─┘                                                 │          │
     addXYZ                                 addXYZ                                     ads not ok    └──────────┘

```
