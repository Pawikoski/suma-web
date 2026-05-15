import { NextResponse } from 'next/server';
import { fetchSync } from '@/lib/api';

export async function GET() {
  const sync = await fetchSync();
  if (!sync) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return new Response(JSON.stringify(sync.server_changes, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="suma-web-export-${timestamp}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
