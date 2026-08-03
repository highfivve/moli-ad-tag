# Inline AI placements scope to an Integration Mode via Label Conditions, not a bespoke field

Each Inline AI placement can carry a `labelCondition`, matched against the ad pipeline's
active labels via the existing generic Label Condition mechanism
(`labelConfigService__.isLabelConditionMet`). To let a publisher scope a placement to one
Integration Mode (e.g. mount this placement only in `hybrid`, not `programmatic`), the
module injects the active mode itself as a synthetic label via `labelConfigService__.addLabel()`
before evaluating placements, rather than adding a dedicated `modes` field to the placement
config.

We picked this over a bespoke field because `addLabel()` is already the documented,
supported mechanism for pipeline steps that need to contribute labels dynamically during a
run (see `LabelConfigService.addLabel`), and it lets a placement combine mode-scoping with
any other existing label (device, geo, `labelCondition` overrides elsewhere) through one
mechanism instead of two independent ones a publisher would have to reason about together.

The trade-off: the synthetic mode label (`'hybrid'`, `'programmatic'`) is added to the
pipeline run's shared label set for its entire remaining duration, not scoped to Inline AI's
own evaluation — a naming collision with an unrelated label used elsewhere in the same config
would be a silent, hard-to-trace bug. We accept this because `addLabel` is scoped to a single
pipeline run (a fresh `labelConfigService` instance per run), and the mode names are
unlikely collision candidates.
