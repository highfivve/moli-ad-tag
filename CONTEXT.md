# Context Glossary

This file is a glossary of the domain language used in `@highfivve/ad-tag` (moli).
It contains terms and their precise meanings — no implementation details.

## Terms

### Label
A string tag that may be active during an ad pipeline run. Labels come from media-query
size config, auto-detected device, geo/domain resolution, the `addLabel()` runtime API, and
the `data-labels` script attribute. Labels are immutable within a single pipeline run.

### Label Condition
A predicate over the active labels, expressed as exactly one of `labelAll` (every listed
label active), `labelAny` (at least one active), or `labelNone` (none active).

### Module Config Override
An alternative module configuration selected when its Label Condition matches the active
labels. Overrides **fully replace** the module's default configuration — they do not merge
field-by-field. A module has at most one default configuration plus an ordered list of
overrides; the **first** override whose Label Condition matches wins. If no override matches,
the default configuration is used.

Distinct from the existing module *activation* gate (`labelCondition` on a module config),
which only turns a module on or off — an override changes *which configuration* an active
module runs with.
