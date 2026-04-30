# Spike Manifest

## Idea
Validate that the BeagleMind round-table agents (Mo, Jarvis, Herman) can reliably emit `[CONTINUE]` / `[DONE]` continuation tokens via prompt engineering alone, in the position and frequency required to drive the D-13 reactive-continuation orchestrator. Output of these spikes = persona SOUL.md edits ready to ship as the agent-side deliverable for D-13.

## Requirements
[Updated as user choices emerge during spiking.]

- Cost is NOT a constraint at this stage — prove the conversation pattern works first
- Token signal must be reliable enough that the orchestrator can trust it without a fallback heuristic
- Persona prompt overhead ≤ 200 tokens per turn

## Spikes

| # | Name | Type | Validates | Verdict | Tags |
|---|------|------|-----------|---------|------|
| 001 | mo-token-reliability | standard | Mo emits exactly one `[CONTINUE]`/`[DONE]` token per reply, ≥90% reliable, meaningfully chosen | PENDING | persona, tokens, mo |
| 002 | jarvis-herman-replication | standard | Same persona prompt achieves ≥90% reliability on Jarvis + Herman | PENDING | persona, tokens, jarvis, herman |
| 003 | three-agent-reactive-flow | standard | Multi-round reactive-continuation conversation develops substantively + terminates cleanly | PENDING | conversation, multi-agent |
