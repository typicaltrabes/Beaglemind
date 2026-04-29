import { db, organizations, createTenantSchema } from '@beagle-console/db';
import { eq, asc, inArray, and, isNull } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Clean-mode event types safe for external replay viewers.
 * System events and any internal-only types are excluded (D-05, D-06).
 */
const CLEAN_EVENT_TYPES = [
  'agent_message',
  'plan_proposal',
  'question',
  'artifact',
  'state_transition',
  'tldr_update',
] as const;

/**
 * Metadata keys that contain Studio-only data and must be stripped
 * before sending to external viewers (T-08-05).
 */
const STRIP_METADATA_KEYS = [
  'sentinelFlags',
  'costData',
  'forkInfo',
  'verbosity',
];

/**
 * Public replay events endpoint -- NO auth required (D-04).
 *
 * Looks up the share link token across all tenant schemas,
 * validates expiry/revocation, returns server-side filtered
 * Clean-mode events, and logs the view.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  // 1. Get all organization IDs (tenants) from Better Auth's organizations table
  const orgs = await db.select({ id: organizations.id }).from(organizations);

  // 2. Search each tenant schema for the token
  let foundLink: {
    id: string;
    runId: string;
    expiresAt: Date;
    revokedAt: Date | null;
  } | null = null;
  let foundTenantId: string | null = null;

  for (const org of orgs) {
    const tenantSchema = createTenantSchema(org.id);
    const rows = await db
      .select({
        id: tenantSchema.shareLinks.id,
        runId: tenantSchema.shareLinks.runId,
        expiresAt: tenantSchema.shareLinks.expiresAt,
        revokedAt: tenantSchema.shareLinks.revokedAt,
      })
      .from(tenantSchema.shareLinks)
      .where(eq(tenantSchema.shareLinks.token, token))
      .limit(1);

    if (rows.length > 0) {
      foundLink = rows[0]!;
      foundTenantId = org.id;
      break;
    }
  }

  // 3. Token not found in any tenant
  if (!foundLink || !foundTenantId) {
    return NextResponse.json(
      { error: 'Replay not found' },
      { status: 404 },
    );
  }

  // 4. Check revocation
  if (foundLink.revokedAt) {
    return NextResponse.json(
      { error: 'This replay has been revoked' },
      { status: 410 },
    );
  }

  // 5. Check expiry
  if (foundLink.expiresAt < new Date()) {
    return NextResponse.json(
      { error: 'This replay has expired' },
      { status: 410 },
    );
  }

  // 6. Query Clean-mode events only (D-05, T-08-05: filter at SQL level)
  const schema = createTenantSchema(foundTenantId);
  const events = await db
    .select()
    .from(schema.events)
    .where(
      and(
        eq(schema.events.runId, foundLink.runId),
        inArray(schema.events.type, [...CLEAN_EVENT_TYPES]),
      ),
    )
    .orderBy(asc(schema.events.sequenceNumber));

  // 7. Strip Studio-only metadata fields from each event (T-08-05) and
  //    expose `timestamp` (the event-shaped field name AgentMessage etc
  //    expect — DB column is `createdAt`). Phase 18-02 followup: replay
  //    timestamps were rendering as `NaN:NaN` in the recipient view because
  //    the formatter was reading `event.timestamp` which didn't exist.
  const sanitizedEvents = events.map((event) => {
    const meta =
      event.metadata && typeof event.metadata === 'object'
        ? { ...(event.metadata as Record<string, unknown>) }
        : event.metadata;
    if (meta && typeof meta === 'object') {
      for (const key of STRIP_METADATA_KEYS) {
        delete (meta as Record<string, unknown>)[key];
      }
    }
    return {
      ...event,
      metadata: meta,
      timestamp: event.createdAt instanceof Date
        ? event.createdAt.toISOString()
        : event.createdAt,
    };
  });

  // 8. Log replay view -- fire-and-forget (D-10, T-08-09)
  const viewerIp =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';
  const userAgent = request.headers.get('user-agent') ?? null;

  // Do NOT await -- fire-and-forget so it doesn't slow the response
  db.insert(schema.replayViews)
    .values({
      shareLinkId: foundLink.id,
      viewerIp,
      userAgent,
    })
    .catch((err) => {
      console.error('Failed to log replay view:', err);
    });

  // 9. Return filtered events
  return NextResponse.json(sanitizedEvents);
}
