import 'server-only';
import { headers } from 'next/headers';
import { SyncResponse } from './api-types';
import { ParsedSyncPreference, parseSyncPreference, parseSyncResponse } from './schemas/sync';
import { getSession } from './session';

const API_URL = process.env.API_URL!;

async function getAccessToken(): Promise<string | null> {
  const h = await headers();
  const headerToken = h.get('x-access-token');
  if (headerToken) return headerToken;
  return (await getSession())?.accessToken ?? null;
}

export async function fetchSync(): Promise<SyncResponse | null> {
  return postSyncChanges({});
}

export async function fetchSyncPreference(): Promise<ParsedSyncPreference | null> {
  const accessToken = await getAccessToken();
  if (!accessToken) return null;

  const res = await fetch(`${API_URL}/api/sync/preferences/`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(body || `Sync preference fetch failed with ${res.status}`);
  }
  return parseSyncPreference(await res.json());
}

export async function postSyncChanges(changes: Record<string, unknown>): Promise<SyncResponse | null> {
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
      changes,
    }),
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(body || `Sync failed with ${res.status}`);
  }
  return parseSyncResponse(await res.json()) as SyncResponse;
}
