import { NextResponse } from 'next/server';
import { requireOperator } from '@/lib/operator';
import { db, tenants } from '@beagle-console/db';

export const runtime = 'nodejs';

/**
 * GET /api/operator/tenants
 * List all tenants (operator-only). Used by break-glass form dropdown.
 */
export async function GET() {
  try {
    await requireOperator();

    const allTenants = await db
      .select({ id: tenants.id, name: tenants.name })
      .from(tenants);

    return NextResponse.json(allTenants);
  } catch (error) {
    console.error('GET /api/operator/tenants error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
