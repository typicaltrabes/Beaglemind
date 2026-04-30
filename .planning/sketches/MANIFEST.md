# Sketch Manifest

## Design Direction
Redesign the run-detail Timeline tab from a single horizontal scrubber-style track into a swim-lane event log. Desktop only — mobile is wireframe-only and out of scope. Event identity should come from spatial position (one row per agent), not color alone. Drop the video-player metaphor (Play / 1×/2×/4×) — the data is a structured event log, not a continuous stream. A dock-style detail panel replaces the dead 380px void below the current track.

## Reference Points
- Linear "issue activity" timeline (vertical agent rows, time-aligned)
- Honeycomb / Datadog APM trace view (swim lanes per service)
- Slack thread side-panel pattern (pick a message → side panel opens with context)

## Sketches

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 001 | timeline-swim-lanes | What swim-lane layout best surfaces "who said what when" + drill-down without losing context? | _pending_ | timeline, layout, run-detail |
