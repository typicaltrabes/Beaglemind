import webpush from 'web-push';
import { db, pushSubscriptions, members } from '@beagle-console/db';
import { eq, inArray } from 'drizzle-orm';
import { createChildLogger } from '../logger';

const log = createChildLogger({ component: 'push-service' });

// Configure VAPID keys from environment
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? 'mailto:traber.luca@gmail.com';

let configured = false;

function ensureConfigured(): boolean {
  if (configured) return true;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    log.warn('VAPID keys not set -- push notifications disabled');
    return false;
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  configured = true;
  return true;
}

interface PushPayload {
  title: string;
  body: string;
  url: string;
}

/**
 * Send push notification to all subscribed users in a tenant (organization).
 * On 410 (Gone) responses, stale subscriptions are deleted.
 */
export async function sendPushNotification(tenantId: string, payload: PushPayload): Promise<void> {
  if (!ensureConfigured()) return;

  try {
    // Find all user IDs in this organization (tenant)
    const orgMembers = await db
      .select({ userId: members.userId })
      .from(members)
      .where(eq(members.organizationId, tenantId));

    if (orgMembers.length === 0) return;

    const userIds = orgMembers.map((m) => m.userId);

    // Get all push subscriptions for these users
    const subscriptions = await db
      .select()
      .from(pushSubscriptions)
      .where(inArray(pushSubscriptions.userId, userIds));

    if (subscriptions.length === 0) return;

    // T-10-04: Truncate body to 100 chars to limit info disclosure
    const safePayload = JSON.stringify({
      ...payload,
      body: payload.body.length > 100 ? payload.body.slice(0, 97) + '...' : payload.body,
    });

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.keysP256dh, auth: sub.keysAuth },
            },
            safePayload,
          );
        } catch (err: any) {
          if (err?.statusCode === 410) {
            // Subscription expired -- clean up
            await db
              .delete(pushSubscriptions)
              .where(eq(pushSubscriptions.id, sub.id));
            log.info({ subId: sub.id }, 'Deleted stale push subscription (410)');
          } else {
            throw err;
          }
        }
      }),
    );

    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length > 0) {
      log.warn({ failedCount: failed.length, total: subscriptions.length }, 'Some push notifications failed');
    }
  } catch (err) {
    log.error({ err, tenantId }, 'Failed to send push notifications');
  }
}

/**
 * Notify tenant users that a plan needs approval (D-08).
 */
export async function notifyPlanApproval(
  tenantId: string,
  runId: string,
  projectId: string,
  planName: string,
): Promise<void> {
  await sendPushNotification(tenantId, {
    title: 'Mo needs approval',
    body: planName,
    url: `/projects/${projectId}/runs/${runId}`,
  });
}

/**
 * Notify tenant users that an agent has a question (D-08).
 */
export async function notifyQuestion(
  tenantId: string,
  runId: string,
  projectId: string,
  agentName: string,
  questionPreview: string,
): Promise<void> {
  await sendPushNotification(tenantId, {
    title: `Question from ${agentName}`,
    body: questionPreview,
    url: `/projects/${projectId}/runs/${runId}`,
  });
}
