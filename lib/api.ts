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
  let generation = 0;
  let cursor = 0;
  let restoreToken: string | null = null;
  let token: string | null = null;
  let pendingChanges = changes;
  let combined: SyncResponse | null = null;
  let recoveries = 0;
  const visited = new Set<string>();

  for (let page = 0; page < 10000; page++) {
    // Serialize once: retries after a lost response must replay this exact UUID/body.
    const body = JSON.stringify({ schema_version: 2, client_id: 'web-client',
      request_id: crypto.randomUUID(), last_sync_token: token,
      sync_reset_generation: generation, restore_cursor: cursor,
      restore_sync_token: restoreToken, changes: pendingChanges });
    const result = await sendSync(body, accessToken);
    if (result.reset_required || result.sync_token_expired) {
      if (++recoveries > 3) throw new Error('Stan synchronizacji zmieniał się podczas pobierania. Spróbuj ponownie.');
      generation = result.sync_reset_generation;
      cursor = 0; restoreToken = null; token = null; combined = null;
      visited.clear();
      continue;
    }
    generation = result.sync_reset_generation;
    pendingChanges = {};
    combined = mergeSyncPages(combined, result);
    if (!result.has_more) {
      if (result.new_sync_token === null && result.errors.length === 0) {
        throw new Error('Brak końcowego tokena synchronizacji.');
      }
      return combined;
    }
    cursor = result.next_restore_cursor ?? 0;
    restoreToken = result.restore_sync_token;
    token = result.next_restore_cursor === null ? result.new_sync_token : null;
    const checkpoint = JSON.stringify([generation, cursor, restoreToken, token]);
    if (visited.has(checkpoint)) throw new Error('Synchronizacja nie przesuwa kursora.');
    visited.add(checkpoint);
  }
  throw new Error('Przekroczono limit stron synchronizacji.');
}

async function sendSync(body: string, accessToken: string): Promise<SyncResponse> {
  for (let attempt = 0; ; attempt++) {
    let response: Response;
    try {
      response = await fetch(`${API_URL}/api/sync/`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body, cache: 'no-store',
      });
    } catch (error) {
      if (attempt < 2) continue;
      throw error;
    }
    if (response.status >= 500 && attempt < 2) continue;
    if (!response.ok) throw new Error(await response.text().catch(() => '') || `Sync failed with ${response.status}`);
    return parseSyncResponse(await response.json());
  }
}

function mergeSyncPages(previous: SyncResponse | null, page: SyncResponse): SyncResponse {
  if (!previous) return page;
  const collections = Object.fromEntries(Object.keys(page.server_changes).map(key => {
    const name = key as keyof SyncResponse['server_changes'];
    const records = new Map<string, unknown>();
    for (const record of [...previous.server_changes[name], ...page.server_changes[name]]) records.set(record.id, record);
    return [key, [...records.values()]];
  })) as SyncResponse['server_changes'];
  return { ...page, server_changes: collections, applied: previous.applied ?? page.applied,
    errors: [...previous.errors, ...page.errors], conflicts: [...previous.conflicts, ...page.conflicts],
    conflict_events: [...previous.conflict_events, ...page.conflict_events] };
}
