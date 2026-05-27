# UX Parity Matrix: Source App -> Portal

## Scope
- Target: visual language parity only.
- Non-goals: route map changes, API/schema changes, IA rebuild.

## Portable vs Non-Portable
| Pattern | Source App | Portal Decision | Why |
| --- | --- | --- | --- |
| Typography system | Barlow Condensed + DM Sans | Portable | Works across portal shell and forms. |
| Dark neutral + gold accent palette | Canonical visual identity | Portable | Reinforces product family consistency. |
| Tokenized spacing/radius/focus | Strongly specified in source | Portable | Enables consistent primitives and accessibility states. |
| Card/panel hierarchy | Reusable across views | Portable | Matches portal data surfaces (forms/tables/previews). |
| Bottom mobile nav | Core source mobile structure | Non-portable | Portal IA is sidebar-first desktop/tablet workflow. |
| Immersive run-screen interval UI | Feature-specific timer flow | Non-portable | Not part of portal admin surfaces. |

## Token Alignment
| Domain | Source Direction | Portal Implementation |
| --- | --- | --- |
| Colors | `bg.app`, `surface.*`, `text.*`, `accent.*`, `danger`, `success` | Mapped to CSS vars in `src/index.css` and consumed by primitives. |
| Typography | Display + body split | `--font-display` + `--font-body`, uppercase condensed headings/nav/buttons. |
| Spacing | 4px-based compact scale | `--space-*` variables and standardized row/grid/panel spacing. |
| Radius | 6/8/10/12/16/full | `--radius-*` variables for fields, cards, buttons, badges. |
| Interaction states | visible focus, active/hover/disabled semantics | Global `:focus-visible` ring, button/nav state variants, disabled styling. |

## Primitive Mapping
| Primitive | Portal Class |
| --- | --- |
| Primary button | `.button` |
| Secondary button | `.button-secondary` |
| Compact action button | `.button-small` |
| Input/select/textarea | global `input, select, textarea` styling |
| Panel/card | `.panel`, `.panel-subtle`, `.metric`, `.asset-preview-card` |
| Nav item | `.nav-link` + `.nav-link.active` |
| Status text | `.ok`, `.error`, `.muted`, `.badge` |
