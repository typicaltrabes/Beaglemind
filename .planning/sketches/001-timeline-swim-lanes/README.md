---
sketch: 001
name: timeline-swim-lanes
question: "What swim-lane layout best surfaces 'who said what when' + drill-down without losing context?"
winner: null
tags: [timeline, layout, run-detail]
---

# Sketch 001: Timeline Swim Lanes

## Design Question
Replace the current Timeline tab — a single horizontal scrubber-style track of overlapping dots, with 380px of dead space and Play/1×/2×/4× controls that don't fit the data. Find the desktop layout that surfaces:

1. **Who** spoke (agent identity by spatial row, not just color)
2. **When** (mm:ss axis with tick marks)
3. **What** (truncated preview on each event pill)
4. **Drill-down** — click any event, read full content + cost + latency + attachments without losing the timeline

Mobile is wireframe-only — out of scope for this sketch.

## How to View
```
open .planning/sketches/001-timeline-swim-lanes/index.html
```

## Variants

- **A — Bottom-docked detail.** Swim lanes fill the top half of the tab; selecting an event opens a detail panel docked along the bottom edge. Lanes stay fully visible; detail panel is a fixed slot in the layout (replaces the dead 380px from current design).
- **B — Side-docked detail.** Lanes get the full vertical space; a 380px detail rail lives on the right. Maximizes lane real estate but compresses lane width.
- **C — Inline expansion.** Click an event → its lane expands beneath the dot to reveal full content. No separate panel, no dead space, but only one event open at a time and the lane height jumps when expanded.

## What to Look For

| Question | Variant A | Variant B | Variant C |
|----------|-----------|-----------|-----------|
| Lanes always visible while reading detail? | ✓ | ✓ | partial (lane shifts) |
| Detail readable at full width? | ✓ wide | restricted to 380px | wide |
| Compare two events side-by-side? | swap selection | swap selection | impossible (one open) |
| Best for short runs (≤ 10 events)? | ✓ | ok | ✓ |
| Best for long runs (50+ events)? | ✓ | ✓ | scrolling jumps |
| Dead space when nothing selected? | yes (empty dock) | yes (empty rail) | none |

Things to scrutinize while clicking around:
- **Lane height** — 56px feels right for sparse data; will it look empty for a 5-event run?
- **Pill truncation** — current cap is 38 chars + ellipsis. Too aggressive? Too generous?
- **Failure-bubble styling** — Mo's t=0:09 failed reply uses dashed red border + italic muted text. Distinct enough from a real reply?
- **System events** — t=1:18 and t=2:44 state transitions render as dashed gray pills. Should they live on a separate "system" lane (current) or be inline ticks on the time axis above?
- **Overlap handling** — at t=78 Herman's reply and the system state-transition both fire simultaneously. In the current design they sit on different lanes so no collision. If two events on the *same* lane overlap, we'd need a stack indicator (`+2`) — none of the variants exercise this yet.

## Sample Data
Modeled from real run UAT-17.1 round-3 (run id `6c18788a-9503-4efe-9e95-f74621cabf57`):
- 2m 44s duration
- 10 events
- 4 active participants (You + Mo + Jarvis + Herman) + system
- $1.06 spend
- Mo's t=0:09 failure-bubble preserved verbatim

## Out of Scope
- Mobile layout (wireframe-only direction)
- Search / filter within timeline
- Export-from-timeline action
- Cross-run timeline comparison
