# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`@highfivve/ad-tag` is an ad tag library called "moli" that orchestrates Google Ad Manager (GAM/gpt.js), Prebid.js, and Amazon TAM (apstag) for display advertising on publisher websites.

## Commands

```bash
# Initial setup (clean install + codegen + build + CSS)
npm run setup

# TypeScript compilation (to lib/)
npm run build:watch        # incremental watch mode
npm run compile            # type-check only, no emit

# Linting
npm run lint               # ESLint + Prettier check
npm run lint:fix           # ESLint + Prettier auto-fix

# Testing
npm test                   # run all tests
npm run test:single:file -- ad-tag/path/to/file.test.ts   # run a single test file
npm run test:single:unit -- --grep 'test name'             # run a specific test by name

# CSS
npm run build:css
npm run setup:css:defaults  # reset publisher CSS overrides to defaults

# Bundles
npm run build:bundle:all    # build all.json bundle
# Custom bundle:
export NODE_ENV=production && npx ts-node bundle.ts --output adtag.mjs --config bundles/standard.json

# Console (debug overlay)
npm run build:console:watch

# Full validation before release
npm run validate            # compile + lint + test
npm run release             # triggers np release flow
```

Mocha IDE runner requires these flags: `--require ts-node/register --require tsconfig-paths/register`

## Architecture

### Directory Layout

```
ad-tag/source/ts/
  ads/          # core ad tag logic
    modules/    # pluggable feature modules
    auctions/   # auction optimization utilities
    bridge/     # postMessage bridge (passback / refresh)
  bundle/       # bundle entry points (one file per optional module)
  types/        # TypeScript types (moliConfig.ts is the main config schema)
  util/         # pure utilities
  gen/          # auto-generated code (do not edit manually)
bundles/        # JSON configs selecting which modules to include in a bundle
dist/           # compiled CSS output
lib/            # compiled TypeScript output (published to npm)
website/        # Docusaurus documentation site
examples/       # example integrations
```

### Core Flow

1. **`moliGlobal.ts` → `initAdTag(window)`** — bootstraps the library, sets `window.moli`, and drains the command queue.
2. **`moli.ts` → `createMoliTag(window)`** — the public `MoliTag` API. Implements a state machine with states: `configurable` → `configured` → `requestAds` → `finished` / `error`. Single-page app adds states `spa-requestAds` / `spa-finished`.
3. **`adService.ts` → `AdService`** — builds and wires the `AdPipeline` based on config (GAM, Prebid, A9, modules).
4. **`adPipeline.ts` → `AdPipeline`** — executes pipeline stages in order for each ad request:
   - `init` — load external scripts (gpt.js, prebid, apstag)
   - `configure` — configure GPT, Prebid, A9; destroy stale slots for SPAs
   - `defineSlots` — create GPT slot definitions, apply size/label filtering
   - `prepareRequestAds` — add Prebid/A9 ad units, yield optimization; steps run by priority (`HIGH_PRIORITY=100`, `LOW_PRIORITY=10`)
   - `requestBids` — `pbjs.requestBids`, A9 fetchBids
   - `requestAds` — fire GPT display/refresh

### Modules

Optional features are modules implementing `IModule` (`types/module.ts`). Each module contributes pipeline steps via:
- `initSteps__()`, `configureSteps__()`, `prepareRequestAdsSteps__()`, `requestBidsSteps__()`, `prebidBidsBackHandler__()`

Modules are registered with `moli.registerModule(...)` before `moli.configure(...)`. Available modules live in `ad-tag/source/ts/ads/modules/` and their bundle entry points in `ad-tag/source/ts/bundle/`.

### Configuration

`MoliConfig` (in `types/moliConfig.ts`) is the main configuration type. It drives everything: ad slots, targeting, sizes, Prebid settings, A9 settings, consent, SPA mode, and module configs. The `schema.json` at repo root is generated from this type via `npm run schema`.

### Key Conventions

- **Path alias**: `ad-tag/*` resolves to `ad-tag/source/ts/*` (configured in `tsconfig.json`).
- **Code generation**: `codeGen.js` generates `ad-tag/source/ts/gen/packageJson.ts` on install. Never edit `gen/` manually.
- **Mangled variables**: Properties/variables suffixed with `__` (e.g. `config__`, `initSteps__`) are intentionally mangled by esbuild in production bundles. Keep this convention for `IModule` interface members.
- **File naming**: kebab-case for files and directories.
- **Functions**: Start with a verb; booleans use `is`/`has`/`can` prefix.
- **Immutability**: Prefer `readonly` on data that doesn't change; `as const` for literals.

### Documentation

- `types/moliConfig.ts` is the source of truth for API documentation (used to generate `schema.json` and the website API docs).
- The public `MoliTag` interface docs live in `types/moliRuntime.ts`.
- `website/docs/api` is auto-generated — do not edit directly.
- When editing docs, run `npm run build` in the `website/` folder to check for broken links.
- Documentation targets developers; always include configuration examples.