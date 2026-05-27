# UX Parity Decisions

## Intentional Deviations
1. Primary navigation remains sidebar-based instead of adopting source mobile bottom-nav patterns.
2. Portal keeps table-driven management views where appropriate; source card-heavy list patterns are adapted through shared tokens/states instead of full structural replacement.
3. Visual parity is implemented through in-place CSS tokenization, not a framework migration.

## UX Parity Checklist (for touched surfaces)
- Uses semantic tokens only; no one-off hard-coded UI colors in component markup.
- Uses shared primitives (`button`, `button-secondary`, `button-small`, `panel`, `badge`, input styles).
- Focus-visible state is clearly visible for keyboard users.
- Disabled states remain legible and non-interactive.
- Success/error feedback uses consistent status classes and proper semantics (`role="status"` / `role="alert"` where applicable).
- Existing IA, routes, and backend contracts remain unchanged.
