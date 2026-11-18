# Product quality audit

The existing private preview was inspected before the interface changes. The desktop walkthrough covered overview, projects, hierarchy, dependency, focus, combined, review queue, configuration and issue evidence. Findings below distinguish observed behavior from subsequent checks.

| Priority | Finding | Change |
| --- | --- | --- |
| P0 | A provider denial could leave old private content visible. A review could use the assignee from an earlier snapshot. | RC clears the session on denial and rechecks current issue identity during review. |
| P1 | Role, workstream, priority and archive controls occupied graph space even on first entry. Reset preserved checkbox filters. | Keep common filters visible, group secondary controls in a disclosure, count active criteria and reset them together. |
| P1 | A dense graph could center on empty space at readable zoom. Obsolete layouts kept running. | Separate readable reset, selection centering and full fit. Cancel obsolete worker jobs. |
| P1 | Overview counts had no drill-down and the queue mixed ordinary work with current review candidates. | Active/completed/blocked counts open scoped hierarchy, project count jumps to projects, configured queue selects actual review states and lists missing reviewers. |
| P1 | Detail evidence and all relationships formed one long list. Keyboard users could leave an open modal. | Collapsible detail sections and shared dialog focus handling, Escape and restoration. |
| P2 | Compact navigation relied on icons and dense controls. | Named navigation, visible keyboard focus, adaptive filter grid and full-screen mobile details. |

The responsive browser suite uses synthetic tasks at 375, 390, 768, 1280 and 1440 CSS pixels and touch events on the three narrower widths. A physical phone, two-finger hardware gestures and a full assistive-technology walkthrough remain separate acceptance items.

Chromium first reproduced a 463px document on 375px and 390px viewports. Wrapping the synthetic fixture controls and allowing narrow selector/title content to shrink resolved the failures. All five widths passed navigation, modal focus, hierarchy search/reset and detail opening/closing in CI run 19. The dense graph case also passed after the test waited for the completed status and enabled camera, accounting for whitespace in the status element. External placeholders for hidden relation types are omitted from the corresponding graph projection.
