# Inline AI placements scope to an Integration Mode via Label Conditions, not a bespoke field

Each Inline AI placement can carry a `labelCondition`, matched against the ad pipeline's
active labels via the existing generic Label Condition mechanism
(`labelConfigService__.isLabelConditionMet`). To let a publisher scope a placement to one
Integration Mode (e.g. mount this placement only in `hybrid`, not `programmatic`), the mode
name is set up as a plain label (`'hybrid'`, `'programmatic'`) in the highfivve portal, the
same as any other label, rather than adding a dedicated `modes` field to the placement config.

We picked this over a bespoke field because `labelCondition` is already the documented,
supported mechanism for scoping a config by label, and it lets a placement combine
mode-scoping with any other existing label (device, geo, `labelCondition` overrides
elsewhere) through one mechanism instead of two independent ones a publisher would have to
reason about together.

The module itself never injects a mode label via `labelConfigService__.addLabel()` — an
earlier version of this decision did that, but a mode label is static per publisher setup,
not something that needs to be computed at pipeline-run time, so it belongs in the portal
config alongside a publisher's other labels rather than in module code.
