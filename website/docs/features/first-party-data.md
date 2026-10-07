---
title: First Party Data
---

First party data is data the publisher knows about the page and the user: what the page is about
(category, tags, keywords), what kind of client it runs on, and — for logged-in users — a hashed
email address. Moli can pass this data to data partners (DMPs) through **first party data
modules**. Each module loads the partner's script or tracking pixel and translates moli's page
data into the parameters that partner expects.

All modules described here read the same moli data sources:

- **Targeting key-values from the config** — `targeting.keyValues` in the `MoliConfig`
  (see [Targeting](./targeting.md)).
- **Runtime key-values** — set on the page via `moli.setTargeting(key, value)` or
  `moli.setConfig({ targeting })` (see [setConfig()](./set-config.md)).
- **Labels** — e.g. the `mobile` label from the size config or `addLabel()`
  (see [Labels](./labels.md)).
- **Audience** — hashed emails set via `moli.setAudience(...)` or `moli.setConfig({ audience })`.

Which data a module sends is configured per module in `modules.<configKey>`. The sections below
describe, per module, which config fields map which moli data into which partner parameter.

## Overview

| Module    | Data sent                                                                                              | Mapping mechanism                                                                                              | Consent (if GDPR applies)                     |
| --------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `roqad`   | Sync URL query parameters: fixed parameters, `audience.hem` hashed email, mapped key-values            | `mappingDefinitions`: key-value `key` → URL `parameter`, optional `defaultValue`. Config + runtime key-values. | Vendors 4 (ROQAD) and 301 (zeotap), purpose 1 |
| `zeotap`  | Script URL query parameters: mapped key-values, `countryCode`, `hashedEmailAddress` from module config | `dataKeyValues`: `keyValueKey` → `parameterKey`; `exclusionKeyValues` block loading. Config key-values only.   | Vendor 301, purposes 1, 3, 4, 5, 6, 7, 9, 10  |
| `emetriq` | Web: `window._enqAdpParam`. App: tracking pixel parameters. Optional login event with hashed email.    | `customMappingDefinition`: key-value `key` → custom parameter `param` (`c_…`). Config + runtime key-values.    | Vendor 213                                    |

All three modules are enabled through `modules.<configKey>.enabled`. Like every module, the config supports
[module config overrides](./module-config-overrides.md).

## Integration

Each module is registered before `moli.configure(...)` is called. When you build the ad tag with
`bundle.ts`, add the module name to the bundle's module list — the name is the bundle entry file
in `ad-tag/source/ts/bundle/`.

| Module    | Bundle entry | Factory           |
| --------- | ------------ | ----------------- |
| `roqad`   | `roqad`      | `createRoqad()`   |
| `zeotap`  | `zeotap`     | `createZeotap()`  |
| `emetriq` | `emetriq`    | `createEmetriq()` |

```json title="bundles/my-bundle.json"
{
  "description": "Bundle with first party data modules",
  "modules": ["roqad", "emetriq", "configureFromEndpoint"]
}
```

If you build your own entry point instead, register the module manually:

```ts
import { createRoqad } from '@highfivve/ad-tag/ads/modules/roqad';

moli.registerModule(createRoqad());
```

## ROQAD

The `roqad` module performs the ROQAD Cookie Sync once per `requestAds()` cycle - once per page
load, and once per virtual page view in a [single page application](#roqad-spa). All page data is
passed to ROQAD as query parameters on the sync URL.

ROQAD belongs to the zeotap family and shares some parameter names (e.g. `z_e_sha2_l`), but it is a
separate integration. Do not configure ROQAD through the `zeotap` module.

### Configuration

```json
{
  "modules": {
    "roqad": {
      "enabled": true,
      "zdid": "1234",
      "publisherName": "example-publisher",
      "syncMethod": "mapper",
      "mappingDefinitions": [
        {
          "roqadValueType": "string",
          "key": "channel",
          "parameter": "category",
          "defaultValue": "none"
        },
        { "roqadValueType": "string", "key": "tags", "parameter": "interests" }
      ]
    }
  }
}
```

| Field                | Description                                                                         |
| -------------------- | ----------------------------------------------------------------------------------- |
| `zdid`               | The ROQAD / zeotap data source id. Sent as `zdid`.                                  |
| `publisherName`      | The publisher name as agreed with ROQAD. Sent as `publisher_name`.                  |
| `syncMethod`         | _optional_ `mapper` (default) or `pixel`. See [below](#roqad-sync-method).          |
| `mappingDefinitions` | Mappings from key-values to additional URL parameters. See [below](#roqad-mapping). |

### Sync method {#roqad-sync-method}

| `syncMethod`       | Description                                                                                                                                                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `mapper` (default) | Loads ROQAD's `mapper.js` (`https://zd.rqtrk.eu/mapper.js`) as a script tag. The script reads the TCF consent from the CMP itself.                                                                                                   |
| `pixel`            | Loads the sync URL (`https://zd.rqtrk.eu/`) directly in a hidden iframe with the id `h5v-roqad-sync`, appended to `document.body`. moli passes the TCF consent as [URL parameters](#roqad-consent-parameters). Recommended for SPAs. |

Both methods send the same [fixed parameters](#roqad-fixed-parameters) and
[parameter mappings](#roqad-mapping).

### Fixed parameters {#roqad-fixed-parameters}

These parameters are always set by the module and are not configurable as mappings.

| Parameter        | Value                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------- |
| `zdid`           | `zdid` from the module config                                                                           |
| `env`            | `mWeb` if the `mobile` [label](./labels.md) is active, `desktop` otherwise                              |
| `eventType`      | always `pageview`                                                                                       |
| `publisher_name` | `publisherName` from the module config                                                                  |
| `partner_dom`    | `window.location.hostname`                                                                              |
| `z_e_sha2_l`     | `audience.hem.sha256BasicNormalized`, falling back to `audience.hem.sha256`. Omitted if neither is set. |

ROQAD hashes email addresses without Gmail-specific rules. Provide the SHA-256 hash of the
_basic-normalised_ email address (only trimmed and lower-cased) as `sha256BasicNormalized`:

```ts
window.moli.que.push(function (moli) {
  // ' John.Doe+news@Gmail.com ' -> 'john.doe+news@gmail.com' -> sha256
  moli.setConfig({
    audience: { hem: { sha256BasicNormalized: '<sha256 hex>', sha256: '<sha256 hex>' } }
  });
});
```

If only `sha256` is set, that value is sent instead. For non-Gmail addresses (and Gmail addresses
without `.` or `+suffix`) both hashes are identical.

### Parameter mapping {#roqad-mapping}

Each entry in `mappingDefinitions` reads one key-value and sends it as one URL parameter.

| Field            | Description                                                                           |
| ---------------- | ------------------------------------------------------------------------------------- |
| `roqadValueType` | Discriminator for the mapping type. Currently only `string` exists.                   |
| `key`            | The key-value key to read.                                                            |
| `parameter`      | The name of the URL parameter sent to ROQAD.                                          |
| `defaultValue`   | _optional_ value used if the key-value is missing, an empty string or an empty array. |

How a value is resolved:

- **Sources**: targeting key-values from the config (`targeting.keyValues`) and runtime key-values
  (`moli.setTargeting` / `setConfig({ targeting })`) are merged. **Runtime key-values win.**
- **Strings** are URL-encoded and sent as is.
- **Arrays** are sent as a comma-separated list. Every element is URL-encoded individually, the
  `,` separator is not encoded.
- **Missing values** — the key is not set, an empty string or an empty array — fall back to
  `defaultValue`. Without a `defaultValue` the parameter is omitted entirely.

With the config above and this page setup

```ts
window.moli.que.push(function (moli) {
  moli.setTargeting('tags', ['cars', 'e-bikes']);
  moli.requestAds();
});
```

and no `channel` key-value, the sync URL contains `category=none&interests=cars,e-bikes`.

### Consent

If GDPR applies, the sync only runs with vendor consent for ROQAD (`4`) **and** zeotap (`301`) and
consent for purpose 1 (store information on a device). If GDPR does not apply, the sync always
runs. This applies to both sync methods. See [Consent](./consent.md).

#### Consent parameters {#roqad-consent-parameters}

With `syncMethod: "pixel"` there is no `mapper.js` that reads the consent from the CMP, so moli
appends these parameters after the mapped parameters:

| Parameter      | Value                                                        |
| -------------- | ------------------------------------------------------------ |
| `cmp`          | always `1`                                                   |
| `gdpr`         | `1` if GDPR applies, `0` if it does not. Omitted if unknown. |
| `gdpr_consent` | The URL-encoded TCF consent string. Omitted if it is empty.  |
| `uc`           | always `1_2`                                                 |

The `mapper` sync method sends no consent parameters.

### Single page applications {#roqad-spa}

The sync runs in the configure phase, once per `requestAds()` cycle. Without SPA mode that is once
per page load; in a [single page application](./single-page-app.md) it is once per virtual page
view, with the key-values present at that time. Lazy loading and slot refreshes run the ad pipeline
again, but never trigger another sync.

Use `"syncMethod": "pixel"` for single page applications:

```json
{
  "modules": {
    "roqad": {
      "enabled": true,
      "zdid": "1234",
      "publisherName": "example-publisher",
      "syncMethod": "pixel",
      "mappingDefinitions": []
    }
  }
}
```

- **`pixel`**: before every sync, the previous iframe is removed. There is always at most one
  `#h5v-roqad-sync` iframe on the page. If your application already removed it, e.g. by
  replacing the body content, a new one is appended without error.
- **`mapper`**: every sync adds a new script tag, and `mapper.js` adds a `<div>` to the page. These
  elements are not cleaned up and accumulate over the lifetime of the single page application.

## Zeotap

The `zeotap` module loads zeotap's `mapper.js` for data collection and, if a hashed email is
configured, activates zeotap's ID+ (identity plus).

### Configuration

```json
{
  "modules": {
    "zeotap": {
      "enabled": true,
      "assetUrl": "//spl.zeotap.com/mapper.js?env=mWeb&eventType=pageview&zdid=1337",
      "mode": "default",
      "countryCode": "DEU",
      "hashedEmailAddress": "<sha256 hex>",
      "dataKeyValues": [
        { "keyValueKey": "channel", "parameterKey": "zcat" },
        { "keyValueKey": "tags", "parameterKey": "zcid" }
      ],
      "exclusionKeyValues": [{ "keyValueKey": "contentType", "disableOnValue": "MedicalTopic" }]
    }
  }
}
```

| Field                | Description                                                                                                    |
| -------------------- | -------------------------------------------------------------------------------------------------------------- |
| `assetUrl`           | The zeotap script URL, containing only the `env`, `eventType` and `zdid` parameters. Can be protocol relative. |
| `mode`               | `default` for server-side rendered pages (script loaded once), `spa` for single page applications.             |
| `countryCode`        | _optional_ Alpha-ISO3 country code, sent as `ctry`. If omitted, zeotap guesses the country from the IP.        |
| `hashedEmailAddress` | _optional_ SHA-256 hashed email address, sent as `z_e_sha2_l`. Enables ID+.                                    |
| `dataKeyValues`      | Key-values to send as URL parameters. See [below](#zeotap-mapping).                                            |
| `exclusionKeyValues` | Key-values that prevent the script from loading, e.g. on sensitive content.                                    |

### Parameter mapping {#zeotap-mapping}

The module appends these parameters to `assetUrl`, in this order:

| Parameter        | Value                                                                               |
| ---------------- | ----------------------------------------------------------------------------------- |
| `idp`            | `1` if `hashedEmailAddress` is set and this is the first script load, `0` otherwise |
| `<parameterKey>` | one parameter per `dataKeyValues` entry                                             |
| `ctry`           | `countryCode`, omitted if not set                                                   |
| `z_e_sha2_l`     | `hashedEmailAddress`, omitted if not set                                            |

Each `dataKeyValues` entry reads the key-value `keyValueKey` and sends it as `parameterKey`:

- **Source**: only the targeting key-values from the config (`targeting.keyValues`). Runtime
  key-values set via `moli.setTargeting` are **not** read.
- **Strings** are URL-encoded.
- **Arrays** are joined with `,` and the joined string is URL-encoded as a whole (so `,` is sent
  as `%2C`).
- **Missing values** — unset or empty — are sent as an empty parameter (`zcat=`). There is no
  default value and the parameter is never omitted.

The hashed email comes from the module config `hashedEmailAddress` only. The moli
`audience` (`setAudience` / `setConfig({ audience })`) is not used by this module.

### Exclusions

If any `exclusionKeyValues` entry matches, the script is not loaded at all. An entry matches if
the config key-value `keyValueKey` equals `disableOnValue`, or — for array values — contains it.
Like the data mapping, exclusions only look at `targeting.keyValues` from the config.

```json
{
  "exclusionKeyValues": [{ "keyValueKey": "contentType", "disableOnValue": "MedicalTopic" }]
}
```

### Consent

In `default` mode, if GDPR applies, the script is only loaded with vendor consent for zeotap
(`301`) and consent for purposes 1, 3, 4, 5, 6, 7, 9 and 10. If GDPR does not apply, the script is
always loaded. See [Consent](./consent.md).

### Single page applications

- `mode: "default"` — the script is loaded once in the init phase. Further loads are rejected.
- `mode: "spa"` — the script is loaded again on every `requestAds()` cycle (configure phase), with
  the key-values of that cycle. ID+ (`idp=1`) is only requested on the first load.

See [Single Page Applications](./single-page-app.md).

## Emetriq

The `emetriq` module sends data to emetriq. It supports two integrations, selected by `os`:

- **Web** (`os: "web"`): sets `window._enqAdpParam` and loads the emetriq script from
  `https://ups.xplosion.de/loader/<sid>/default.js`.
- **App** (`os: "android"` or `"ios"`): sends a tracking pixel to `https://aps.xplosion.de/data`.
  Use this when moli runs inside an app webview.

Both integrations can additionally send a [login event](#emetriq-login) with a hashed email.

### Configuration

Web:

```json
{
  "modules": {
    "emetriq": {
      "enabled": true,
      "os": "web",
      "syncDelay": "pbjs",
      "_enqAdpParam": {
        "sid": 12345,
        "c_site": "example"
      },
      "customMappingDefinition": [
        { "param": "c_channel", "key": "channel" },
        { "param": "c_tags", "key": "tags" }
      ],
      "login": { "partner": "example-partner" }
    }
  }
}
```

App:

```json
{
  "modules": {
    "emetriq": {
      "enabled": true,
      "os": "android",
      "sid": 12345,
      "appId": "de.example.app",
      "advertiserIdKey": "advertising_id",
      "keywordsKey": "keywords",
      "additionalIdentifier": { "id_sharedid": "abc" },
      "customKeywords": { "c_site": "example" },
      "customMappingDefinition": [{ "param": "c_channel", "key": "channel" }]
    }
  }
}
```

| Field                     | Integration | Description                                                                                     |
| ------------------------- | ----------- | ----------------------------------------------------------------------------------------------- |
| `os`                      | both        | `web`, `android` or `ios`                                                                       |
| `syncDelay`               | both        | _optional_ `pbjs` (wait for the first prebid `auctionEnd`) or a delay in ms. Default: no delay. |
| `customMappingDefinition` | both        | _optional_ key-value → custom parameter mappings. See [below](#emetriq-mapping).                |
| `login`                   | both        | _optional_ login event config. See [below](#emetriq-login).                                     |
| `_enqAdpParam`            | web         | Static parameters for `window._enqAdpParam`. `sid` is required and also used in the script URL. |
| `sid`                     | app         | emetriq account id                                                                              |
| `appId`                   | app         | App store id of the app                                                                         |
| `advertiserIdKey`         | app         | Key-value key holding the advertising id, sent as `device_id`                                   |
| `keywordsKey`             | app         | _optional_ key-value key whose value is sent as `keywords`                                      |
| `additionalIdentifier`    | app         | _optional_ static identifiers (`id_id5`, `id_sharedid`, …)                                      |
| `customKeywords`          | app         | _optional_ static custom parameters                                                             |

### Parameter mapping {#emetriq-mapping}

Each `customMappingDefinition` entry reads the key-value `key` and sends it as the custom parameter
`param`. Custom parameter names must start with `c_`.

- **Sources**: targeting key-values from the config and runtime key-values (`moli.setTargeting` /
  `setConfig({ targeting })`) are merged. **Runtime key-values win.**
- **Arrays** are joined into a single comma-separated string.
- **Missing values** — unset or an empty string — are omitted. There is no default value.

Where the mapped values end up depends on the integration.

**Web** — `window._enqAdpParam` is built from, in order of increasing precedence:

1. the static `_enqAdpParam` from the module config,
2. prebid user ids, if `syncDelay` is `pbjs` (see below),
3. the mapped custom parameters.

The custom parameters are computed once, when the script is loaded in the init phase.

**App** — the pixel URL contains:

| Parameter              | Value                                                                         |
| ---------------------- | ----------------------------------------------------------------------------- |
| `sid`, `os`, `app_id`  | from the module config                                                        |
| `device_id`            | key-value `advertiserIdKey` (first element for arrays), omitted if not set    |
| `keywords`             | key-value `keywordsKey`, arrays joined with `,`, omitted if not set           |
| `link`                 | always `window.location.href`                                                 |
| identifiers            | `additionalIdentifier` merged with prebid user ids (prebid ids win)           |
| custom parameters      | `customKeywords` merged with the mapped custom parameters (mapped values win) |
| `gdpr`, `gdpr_consent` | `gdpr=1&gdpr_consent=<tcString>` if GDPR applies, `gdpr=0` otherwise          |

`device_id` and `keywords` read the merged key-values, so an app webview can pass the advertising
id at runtime:

```ts
window.moli.que.push(function (moli) {
  moli.setTargeting('advertising_id', '38400000-8cf0-11bd-b23e-10b96e40000d');
  moli.setTargeting('keywords', ['cars', 'e-bikes']);
  moli.requestAds();
});
```

#### Prebid user ids

With `syncDelay: "pbjs"` the module waits for the first prebid `auctionEnd` event and adds these
user ids from `pbjs.getUserIds()`:

| prebid user id | emetriq identifier |
| -------------- | ------------------ |
| `amxId`        | `id_amxid`         |
| `idl_env`      | `id_liveramp`      |
| `IDP`          | `id_zeotap`        |
| `pubcid`       | `id_sharedid`      |
| `id5id.uid`    | `id_id5`           |

With a numeric `syncDelay` the module only waits that many milliseconds and adds no identifiers.

### Login events {#emetriq-login}

If `login` is configured, the module sends a login event pixel to
`https://xdn-ttp.de/lns/import-event-<partner>` at most once per day (tracked in `sessionStorage`
under `moli_emetriq`).

| Parameter              | Value                                                                                                                                    |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `guid`                 | `btoa(audience.hem.sha256)` if `audience.hem.sha256` is set, otherwise `login.guid` from the config. No event is sent if neither is set. |
| `gdpr`, `gdpr_consent` | `gdpr=1&gdpr_consent=<tcString>` if GDPR applies, `gdpr=0` otherwise                                                                     |
| `adid` / `idfa`        | app only: key-value `advertiserIdKey` from the config `targeting.keyValues` (`adid` on android, `idfa` on ios)                           |

```ts
window.moli.que.push(function (moli) {
  moli.setConfig({ audience: { hem: { sha256: '<sha256 hex>' } } });
  moli.requestAds();
});
```

### Consent

If GDPR applies, nothing is sent without vendor consent for emetriq (`213`); a warning is logged.
No purpose consents are checked by the module. In the `test` [environment](./environments.md)
emetriq is never loaded.

### Single page applications

- **Web**: the script is loaded once in the init phase.
- **App** and **login events**: run in the configure phase once per `requestAds()` cycle, so the
  app pixel is sent again on every SPA page view with that page's key-values. Login events are
  still limited to once per day.

See [Single Page Applications](./single-page-app.md).

## Related

- [Targeting](./targeting.md)
- [Labels](./labels.md)
- [Consent (TCF2)](./consent.md)
- [setConfig() API Reference](./set-config.md)
- [Single Page Applications](./single-page-app.md)
- [Module Config Overrides](./module-config-overrides.md)
- Module reference: [roqad](../modules/roqad.md), [zeotap](../modules/zeotap.md),
  [emetriq](../modules/emetriq.md)
