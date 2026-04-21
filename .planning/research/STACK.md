# Technology Stack

**Project:** Beagle Agent Console
**Researched:** 2026-04-21

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Next.js | 15.5.x | Full-stack React framework | App Router is stable, standalone output for Docker, SSE streaming via Route Handlers. Next.js 16 exists but 15.5 is battle-tested and backport-maintained. Upgrade to 16 in CP2. | HIGH |
| React | 19.x | UI library | Stable with Next.js 15.5. Server Components for initial load, Client Components for real-time transcript UI. | HIGH |
| TypeScript | 5.7+ | Type safety | Non-negotiable for multi-tenant isolation correctness. Drizzle and Better Auth are TypeScript-first. | HIGH |
| Tailwind CSS | 4.x | Styling | v4 is stable, CSS-first config, works with shadcn/ui. Zero-runtime, critical for transcript render perf. | HIGH |
| shadcn/ui | latest | Component library | Copy-paste components, full ownership. Chat/transcript components available via shadcn-chat CLI extension. Not a dependency -- vendor into repo. | HIGH |

### Real-Time Communication

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Node WebSocket service (ws) | ws@8.x | Agent<->Console bidirectional comms | OpenClaw agents need persistent bidirectional connections. WebSocket is correct for agent hub -- agents push messages, console sends commands. Runs as separate Node process. | HIGH |
| SSE (Route Handlers) | Native | Browser<->Next.js streaming | For streaming agent messages to the browser UI. SSE is simpler than WebSocket for server-to-client push, works through Caddy without upgrade headers, auto-reconnects. Next.js Route Handlers support ReadableStream natively. | HIGH |

**Architecture: Use BOTH WebSocket and SSE.**

```
OpenClaw Agents <--WebSocket--> Agent Hub (Node) <--Redis pub/sub--> Next.js API <--SSE--> Browser
```

- WebSocket between Agent Hub and OpenClaw agents (bidirectional, persistent, agent lifecycle mgmt)
- SSE between Next.js and browser (unidirectional streaming, simpler than WS for UI, no upgrade dance with Caddy)
- Redis pub/sub bridges the two services (Agent Hub publishes, Next.js subscribes per-session)
- If you later need browser-to-server real-time (interrupt, @-mention mid-stream), add a single WebSocket endpoint on the Next.js side or use standard POST requests

**Do NOT use Vercel AI SDK for this.** The AI SDK is designed for direct LLM streaming (useChat -> streamText). Your architecture has OpenClaw agents as intermediaries -- the console doesn't call LLMs directly, it observes agent conversations routed through the Agent Hub. Vercel AI SDK would add an abstraction layer that doesn't match your data flow. Use raw SSE + your own React hooks.

### State Management

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Zustand | 5.0.x | Client-side state | Best balance of simplicity and power for 2026 React. ~3KB, middleware ecosystem (persist, devtools, immer). Zustand stores for: active run transcript, agent status, UI mode (Clean/Studio), user preferences. | HIGH |

**Why Zustand over Jotai:** Your transcript UI has a clear store shape (runs, messages, agents, UI state). Zustand's store-based model maps naturally. Jotai's atomic model shines for deeply interconnected derived state -- overkill here. Zustand's `subscribeWithSelector` gives fine-grained re-render control for high-frequency message updates.

**Pattern for real-time transcript:**
```typescript
// One store per active run, messages as normalized Map<messageId, Message>
// SSE listener appends to store, React components subscribe to slices
// Use immer middleware for immutable updates on nested message state
```

### Database & ORM

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| PostgreSQL | 17.4 | Primary database | Already running on BeagleHQ. Per-tenant schema isolation is native Postgres via `CREATE SCHEMA`. | HIGH |
| Drizzle ORM | 0.45.x | Type-safe ORM | Lightweight (~7.4KB), zero dependencies, TypeScript-first. `pgSchema()` API supports per-tenant schema routing. Drizzle Kit for migrations. | HIGH |
| drizzle-kit | 0.30.x | Migrations CLI | Schema push and migration generation. Run per-tenant via script that iterates schemas. | MEDIUM |

**Per-tenant schema isolation pattern with Drizzle:**

```typescript
import { pgSchema } from 'drizzle-orm/pg-core';

// Factory function: creates typed schema for any tenant
function createTenantSchema(tenantId: string) {
  const schema = pgSchema(`tenant_${tenantId}`);
  return {
    runs: schema.table('runs', { /* columns */ }),
    messages: schema.table('messages', { /* columns */ }),
    // ... all tenant tables
  };
}

// Shared schema for cross-tenant data (tenants table, billing, auth)
const shared = pgSchema('shared');

// Middleware extracts tenantId, creates scoped Drizzle instance
function getTenantDb(tenantId: string) {
  const tables = createTenantSchema(tenantId);
  return { db: drizzle(pool), ...tables };
}
```

**Migration strategy:** Write migrations once against a template schema. Tenant provisioning script creates schema + runs migrations. Use a `_migrations` table per schema to track applied migrations. The `drizzle-multitenant` community toolkit (github.com/mateusflorez/drizzle-multitenant) provides scaffolding but evaluate whether you need it -- the pattern above is ~50 lines of code.

**Pitfall:** Drizzle v1.0 is in beta (1.0.0-beta.2). Stay on 0.45.x stable. The v1 upgrade path is documented but wait for GA.

### Authentication

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Better Auth | 1.6.x | Auth framework | Self-hosted, TypeScript-first, MIT licensed. Built-in: 2FA/MFA, passkeys, sessions, Organization plugin for multi-tenant. Drizzle adapter with join support (v1.4+). No vendor lock-in. | HIGH |

**Multi-tenant configuration:**

- **Organization plugin:** Maps to tenants. Each org = one tenant. Members have roles (owner, admin, member).
- **Drizzle adapter:** Generate schema with `npx @better-auth/cli generate` -- creates user, session, account, organization, member tables in the shared schema.
- **Tenant context flow:** Auth middleware resolves user -> active organization -> tenantId -> scoped DB.
- **MFA:** Built-in TOTP + backup codes. Enable per-organization policy.
- **Session strategy:** Database sessions (not JWT) for revocability. Important for operator break-glass.

**Do NOT use NextAuth/Auth.js.** Better Auth is more complete for multi-tenant SaaS (built-in organizations, RBAC, MFA) without the config complexity and adapter fragmentation of Auth.js.

### Job Queue

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| BullMQ | 5.x | Background jobs | Redis-backed, TypeScript, battle-tested. Use for: agent task dispatch, artifact processing, notification delivery, scheduled digests, tenant provisioning. Already have Redis on BeagleHQ. | HIGH |

**Key patterns:**
- Named queues: `agent-tasks`, `notifications`, `artifacts`, `tenant-ops`
- Retry with exponential backoff (3 attempts, 1s initial)
- Job flows for multi-step agent workflows (child jobs complete before parent)
- Progress tracking for long-running agent runs
- Rate limiting per tenant for cost control

### File Storage

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| MinIO | latest | S3-compatible object storage | Self-hosted, Docker-native, S3 API compatible. Use `@aws-sdk/client-s3` for presigned URLs. Bucket-per-tenant for isolation. | HIGH |

**Pattern:** Presigned upload URLs from Next.js API -> client uploads directly to MinIO -> webhook/callback confirms -> store metadata in Postgres.

### Infrastructure

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Caddy | 2.x | Reverse proxy + TLS | Already running on BeagleHQ. Auto HTTPS via Let's Encrypt. Route console.beaglemind.ai to Next.js container. Handles SSE and WebSocket upgrade. | HIGH |
| Docker Compose | 2.x | Container orchestration | Good enough for single-VPS deployment. Next.js + Agent Hub + MinIO + BullMQ workers as containers. Postgres and Redis already running on host. | HIGH |
| Redis | 7.x | Cache + pub/sub + BullMQ backend | Already on BeagleHQ. Triple duty: BullMQ job storage, SSE pub/sub bridge, session cache. | HIGH |

### PWA Tooling

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| @serwist/next | 9.5.x | Service worker + caching | Successor to next-pwa, actively maintained, Workbox-based. Precache app shell, stale-while-revalidate for assets. | MEDIUM |
| web-push | 3.x | Push notifications | Provider-free VAPID push. No third-party service needed. For question-queue and plan-approval alerts. | MEDIUM |

**PWA is Phase 2+.** Focus on core web app first. PWA adds offline shell + push notifications for mobile question-queue use case. Serwist handles service worker generation; web-push handles server-side VAPID notification delivery.

**Alternative considered:** Manual service worker without Serwist. Next.js 16 docs suggest this for full control. But Serwist's precaching + routing strategies save significant boilerplate. Use Serwist.

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | 3.x | Schema validation | API input validation, form validation, env var validation. Already required by Better Auth. |
| date-fns | 4.x | Date formatting | Transcript timestamps, run durations. Tree-shakeable, no moment.js. |
| nanoid | 5.x | ID generation | Short, URL-safe IDs for share-links, run IDs. |
| @tanstack/react-query | 5.x | Server state | REST data fetching (runs list, artifacts, settings). NOT for real-time transcript -- that's Zustand + SSE. |
| react-virtuoso | 4.x | Virtualized lists | Transcript rendering for long runs (thousands of messages). Scroll-to-bottom, dynamic height items. |
| @aws-sdk/client-s3 | 3.x | MinIO client | S3-compatible API for presigned URLs and file operations. |
| sharp | 0.33.x | Image processing | Artifact thumbnails, avatar resizing. Server-side only. |
| shadcn-chat | latest | Chat components | CLI extension for shadcn/ui. Adds ChatInput, Message, GenerationStatus components. Vendor into repo. |

### Dev Tooling

| Tool | Purpose | Why |
|------|---------|-----|
| Biome | Linting + formatting | Replaces ESLint + Prettier. Faster, single tool. Opinionated defaults. |
| Vitest | Unit + integration testing | Fast, ESM-native, compatible with React Testing Library. |
| Playwright | E2E testing | Cross-browser, reliable. Test critical flows: auth, run creation, transcript streaming. |
| drizzle-kit | DB migrations | Bundled with Drizzle ecosystem. |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Framework | Next.js 15.5 | Next.js 16 | 16 is new (Apr 2026). 15.5 has backport security fixes. Upgrade path is clean. |
| ORM | Drizzle | Prisma | Prisma is heavier, slower cold starts, no native pgSchema() for per-tenant isolation. Drizzle is lighter and schema-isolation-friendly. |
| Auth | Better Auth | NextAuth/Auth.js | Auth.js lacks built-in organizations, MFA is plugin-fragmented, adapter ecosystem is messy. Better Auth is purpose-built for multi-tenant SaaS. |
| State | Zustand | Jotai | Jotai's atomic model adds complexity without benefit for store-shaped state. Zustand is simpler for this use case. |
| State | Zustand | Redux Toolkit | Over-engineered for this scale. Zustand does the same with 1/10th the boilerplate. |
| Streaming | SSE (browser) | WebSocket (browser) | SSE is simpler for server-to-client push. No upgrade headers, auto-reconnect, works better through proxies. WebSocket only needed for agent hub <-> OpenClaw. |
| AI SDK | Raw SSE + hooks | Vercel AI SDK | AI SDK assumes direct LLM calls. Our agents are OpenClaw processes, not direct model invocations. The abstraction doesn't fit. |
| PWA | Serwist | Manual SW | Serwist saves boilerplate for precaching and routing strategies. Manual SW only if you need exotic caching logic. |
| File storage | MinIO | Local filesystem | Multi-container deployment needs shared storage. MinIO provides S3 API, bucket-per-tenant isolation, presigned URLs. |
| Queue | BullMQ | Agenda/Bee-Queue | BullMQ is the maintained successor to Bull, TypeScript-native, Redis Streams-based. Others are in maintenance mode. |
| Formatting | Biome | ESLint + Prettier | Single tool, faster, less config. ESLint flat config is still painful. |

## Docker Compose Services

```yaml
# Containers to add to existing BeagleHQ docker-compose
services:
  console-web:
    build: ./apps/web
    # Next.js standalone output
    environment:
      - DATABASE_URL=postgresql://...
      - REDIS_URL=redis://host.docker.internal:6379
    ports:
      - "3000:3000"
    restart: unless-stopped

  console-agent-hub:
    build: ./apps/agent-hub
    # Node WebSocket service
    environment:
      - REDIS_URL=redis://host.docker.internal:6379
      - DATABASE_URL=postgresql://...
    ports:
      - "3001:3001"
    restart: unless-stopped

  console-worker:
    build: ./apps/worker
    # BullMQ job processor
    environment:
      - REDIS_URL=redis://host.docker.internal:6379
      - DATABASE_URL=postgresql://...
    restart: unless-stopped

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    volumes:
      - minio_data:/data
    ports:
      - "9000:9000"
      - "9001:9001"
    restart: unless-stopped
```

**Note:** PostgreSQL 17.4 and Redis 7.x already run on BeagleHQ host. Access via `host.docker.internal` or Docker network. Do NOT containerize them again -- use the existing instances.

**Caddy config addition:**
```
console.beaglemind.ai {
    reverse_proxy localhost:3000
}
```

## Installation

```bash
# Core
npm install next@15.5 react@19 react-dom@19 typescript@5.7

# Database
npm install drizzle-orm@0.45 postgres

# Auth
npm install better-auth@1.6

# State + Data Fetching
npm install zustand@5 @tanstack/react-query@5

# UI
npm install tailwindcss@4 class-variance-authority clsx tailwind-merge
npx shadcn@latest init

# Real-time
npm install ws

# Queue
npm install bullmq

# File Storage
npm install @aws-sdk/client-s3

# Utilities
npm install zod nanoid date-fns

# PWA (Phase 2)
npm install @serwist/next @serwist/precaching @serwist/sw web-push

# Dev dependencies
npm install -D drizzle-kit @types/node @types/react @types/ws
npm install -D vitest @vitejs/plugin-react
npm install -D @biomejs/biome
npm install -D playwright @playwright/test
```

## Sources

- [Next.js 15.5 release](https://nextjs.org/blog/next-15-5) - HIGH confidence
- [Drizzle ORM docs](https://orm.drizzle.team/) - HIGH confidence
- [Better Auth docs](https://better-auth.com/docs/installation) - HIGH confidence
- [Better Auth Drizzle adapter](https://better-auth.com/docs/adapters/drizzle) - HIGH confidence
- [BullMQ docs](https://docs.bullmq.io/) - HIGH confidence
- [Serwist Next.js integration](https://serwist.pages.dev/docs/next) - MEDIUM confidence
- [Zustand v5](https://github.com/pmndrs/zustand/releases) - HIGH confidence
- [shadcn-chat components](https://github.com/jakobhoeg/shadcn-chat) - MEDIUM confidence
- [Drizzle multi-tenant schema pattern](https://medium.com/@vimulatus/schema-based-multi-tenancy-with-drizzle-orm-6562483c9b03) - MEDIUM confidence
- [MinIO Docker setup](https://www.datacamp.com/tutorial/minio-docker) - HIGH confidence
- [Next.js PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps) - HIGH confidence
