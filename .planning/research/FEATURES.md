# Feature Landscape

**Domain:** Multi-agent AI console / observable reasoning system
**Researched:** 2026-04-21

## Table Stakes

Features users expect. Missing = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Real-time agent transcript | Core value prop. Users must see agents think out loud as it happens. | High | SSE streaming, virtualized list, scene auto-naming |
| Plan approval gate | Users expect to approve before spend. WhatsApp pain point was uncontrolled cost. | Medium | Modal with cost estimate, approve/reject/modify |
| Question queue | Agents must ask, not assume. Core governance mechanism. | Medium | Queue UI, notification, batch answer |
| Authentication + MFA | Enterprise SaaS table stakes. Boutique finance firms require MFA. | Medium | Better Auth Organization plugin handles this |
| Run history + search | Users need to find past investigations. | Low | Paginated list, basic search, status filters |
| Artifact delivery | Research sprint must produce deliverables (reports, data, analysis). | Medium | File upload to MinIO, inline preview, download |
| Stop button | Users must be able to halt runaway agent activity. | Low | Send cancel signal through Agent Hub, agents respect graceful stop |
| Mobile-responsive UI | Finance professionals check from phone. PWA not needed yet, but responsive layout is. | Medium | Tailwind responsive, mobile-first transcript |
| Cost visibility | Per-run cost tracking. LiteLLM already tracks per-agent. Surface in UI. | Low | Read from LiteLLM metrics, display per-run |

## Differentiators

Features that set product apart. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Clean/Studio mode toggle | Clean mode for consumption, Studio for power users. Same user, two contexts. Novel UX pattern. | Medium | Conditional rendering, not role-gating |
| Three-mechanism disagreement | Organic pushback + Mo auto-counterpoint + user red-team. Makes reasoning visibly adversarial. | High | Requires agent training + UI for red-team trigger |
| Replay share-links | Tokenized, time-boxed, revocable links showing Clean-mode content only. Marketing flywheel. | High | Separate renderer, content filtering, audit log |
| Timeline scrubber | Horizontal scrubbable replay of a completed run. Like a video timeline for reasoning. | High | Custom component, time-indexed message positioning |
| Scene auto-naming + collapse | Transcript auto-segments into named scenes. Collapse old scenes for readability. | Medium | Heuristic or agent-driven scene boundary detection |
| Live TLDR banner | Running summary of what's happening, updated as agents work. | Medium | Agent-generated summary, SSE-pushed |
| Boardroom view | Parallel agent columns showing each agent's perspective side-by-side. | Medium | CSS grid layout, per-agent message filtering |
| Canvas view | Artifact-first document surface with margin agent comments. | High | Rich document rendering, annotation system |
| Sentinel passive logging | Sam observes Mo, logs quality signals. Invisible to user in Clean mode. | Medium | Background process, structured log storage |
| Process drawer (Studio) | Sentinel data, cost breakdown, fork info, agent metadata. Power user panel. | Medium | Slide-out drawer, real-time data from multiple sources |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Freeform chat with Mo | Unstructured interaction defeats governance. Leads to uncontrolled spend. | Structured research sprint workflow only. User prompts -> Mo plans -> approval gate. |
| Multi-user real-time collaboration | Complexity vs. value doesn't justify for v1. Two-person team, single-user per run. | Single-user runs. Replay sharing covers the "show others" use case. |
| Slack/email integrations | Distraction from core loop. Integration surface area explodes. | Focus on in-app notifications + PWA push. |
| Free tier | Enterprise-only positioning. Free tier attracts wrong users, dilutes support. | Paid from day one. Demo via replay share-links. |
| Custom agent personas | Premature customization. Agent fleet is fixed (Mo, Jarvis, Sam, etc.). | Fixed agent roster with operator-managed configuration. |
| White-label | Premature. No customer demand signal yet. | Single brand, single deployment. |
| Native mobile app | PWA covers the mobile use case (question queue + digest). App store overhead not justified. | PWA with Serwist + web-push for notifications. |
| Role-gated UI | All Year-1 users get Clean + Studio. Role complexity doesn't help two-person team. | Year 2+ consideration. Toggle, not gate. |

## Feature Dependencies

```
Authentication -> Tenant Isolation -> Everything else
Tenant Isolation -> Agent Hub connection (needs tenant context)
Agent Hub -> Research Sprint Workflow
Research Sprint -> Plan Approval Gate
Research Sprint -> Question Queue
Research Sprint -> Transcript UI
Research Sprint -> Artifact Delivery
Transcript UI -> Scene Auto-naming
Transcript UI -> Clean/Studio toggle
Transcript UI -> Timeline Scrubber (deferred)
Transcript UI -> Boardroom View (deferred)
Artifact Delivery -> Canvas View (deferred)
Replay Share-links -> Transcript UI + Content Filtering
Sentinel Logging -> Agent Hub (observes traffic)
Sentinel Logging -> Process Drawer
Push Notifications -> PWA Setup
PWA -> Service Worker (Serwist)
```

## MVP Recommendation

**Prioritize (Product Proof gate):**
1. Authentication + tenant isolation (everything depends on it)
2. Agent Hub WebSocket service (connects to OpenClaw agents)
3. Research sprint workflow: prompt -> plan -> approval -> execution -> delivery
4. Transcript UI with real-time streaming (the headline feature)
5. Plan approval gate with cost estimate
6. Question queue
7. Stop button
8. Run history

**Defer to Company Proof:**
- Replay share-links (PP3 deliverable per PROJECT.md, but not blocking internal daily-drive)
- Clean/Studio mode toggle (start with Studio-like experience, add Clean later)
- Timeline scrubber
- Boardroom view
- Canvas view
- PWA + push notifications
- Sentinel beyond passive logging
- Red-team mechanism

## Sources

- PROJECT.md requirements and scope analysis
- [shadcn-chat components](https://github.com/jakobhoeg/shadcn-chat) for transcript UI patterns
- [Vercel AI SDK multi-agent patterns](https://dev.to/jackchenme/adding-multi-agent-orchestration-to-a-vercel-ai-sdk-app-4536) for architecture reference
