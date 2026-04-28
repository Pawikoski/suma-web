import 'server-only';
import { headers } from 'next/headers';
import { SyncResponse } from './api-types';
import { parseSyncResponse } from './schemas/sync';

const API_URL = process.env.API_URL!;

async function getAccessToken(): Promise<string | null> {
  const h = await headers();
  return h.get('x-access-token');
}

export async function fetchSync(): Promise<SyncResponse | null> {
  const accessToken = await getAccessToken();
  if (!accessToken) return null;

  const res = await fetch(`${API_URL}/api/sync/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      client_id: 'web-client',
      request_id: crypto.randomUUID(),
      last_sync_token: null,
      changes: {},
    }),
    cache: 'no-store',
  });

  if (!res.ok) return null;
  return parseSyncResponse(await res.json()) as SyncResponse;
}
