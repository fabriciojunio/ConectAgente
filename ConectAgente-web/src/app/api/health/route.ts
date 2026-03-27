import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Health check endpoint for monitoring and deployment verification.
 * GET /api/health
 *
 * Returns:
 * - 200: Service is healthy, DB is reachable
 * - 503: Service is degraded (DB unreachable)
 */
export async function GET() {
  const start = Date.now();

  try {
    const supabase = await createClient();

    // Quick DB connectivity check (lightweight query)
    const { error } = await supabase
      .from('agentes')
      .select('id', { count: 'exact', head: true })
      .limit(1);

    const latencyMs = Date.now() - start;

    if (error) {
      return NextResponse.json(
        {
          status: 'degraded',
          timestamp: new Date().toISOString(),
          database: 'unreachable',
          error: error.message,
          latencyMs,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      latencyMs,
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: err instanceof Error ? err.message : 'Unknown error',
        latencyMs: Date.now() - start,
      },
      { status: 503 }
    );
  }
}
