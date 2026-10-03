import 'server-only';
import { headers } from 'next/headers';
import { SyncResponse } from './api-types';
import { FxRates, parseCurrencyRates } from './fx';
import { ParsedSyncPreference, parseSyncPreference, parseSyncResponse } from './schemas/sync';
import { getSession } from './session';
import { SyncRequestError, syncHttpError } from './sync-errors';

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

/** Rates to `base` for the totals in the main currency; null when the API has none (totals then skip other currencies). */
export async function fetchCurrencyRates(base: string): Promise<FxRates | null> {
  const res = await fetch(`${API_URL}/api/currency-rates/?base=${encodeURIComponent(base)}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return parseCurrencyRates(await res.json());
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
    throw await syncHttpError(res);
  }
  return parseSyncPreference(await res.json());
}

export async function postSyncChanges(changes: Record<string, unknown>, expectedGeneration?: number): Promise<SyncResponse | null> {
  const accessToken = await getAccessToken();
  if (!accessToken) return null;
  let generation = expectedGeneration ?? 0;
  let cursor = 0;
  let restoreToken: string | null = null;
  let token: string | null = null;
  let pendingChanges = changes;
  let combined: SyncResponse | null = null;
  let recoveries = 0;
  let acceptedOutcome: SyncResponse | null = null;
  const visited = new Set<string>();

  for (let page = 0; page < 10000; page++) {
    // Serialize once: retries after a lost response must replay this exact UUID/body.
    const body = JSON.stringify({ schema_version: 3, client_id: 'web-client',
      request_id: crypto.randomUUID(), last_sync_token: token,
      sync_reset_generation: generation, restore_cursor: cursor,
      restore_sync_token: restoreToken, changes: pendingChanges });
    let result: SyncResponse;
    try { result = await sendSync(body, accessToken); }
    catch (error) {
      if (acceptedOutcome) throw new SyncRequestError('Zapis został wysłany, ale pobieranie wyniku przerwano. Sprawdź wynik przed nową operacją.', 0, 'outcome_unknown', { cause: error });
      throw error;
    }
    if (result.reset_required && Object.keys(changes).length > 0 && (expectedGeneration !== undefined || acceptedOutcome)) {
      throw new SyncRequestError('Dane synchronizacji zostały zresetowane. Odśwież dane przed ponownym zapisem.', 409, 'sync_reset_required');
    }
    if (result.reset_required || result.sync_token_expired) {
      if (++recoveries > 3) throw new Error('Stan synchronizacji zmieniał się podczas pobierania. Spróbuj ponownie.');
      generation = result.sync_reset_generation;
      cursor = 0; restoreToken = null; token = null; combined = null;
      visited.clear();
      continue;
    }
    generation = result.sync_reset_generation;
    if (Object.keys(pendingChanges).length > 0) acceptedOutcome = result;
    pendingChanges = {};
    combined = mergeSyncPages(combined, result);
    if (!result.has_more) {
      if (result.new_sync_token === null && result.errors.length === 0) {
        throw new Error('Brak końcowego tokena synchronizacji.');
      }
      // A restore restart discards snapshot rows, never the mutation's outcome.
      return acceptedOutcome ? { ...combined, applied: acceptedOutcome.applied,
        errors: acceptedOutcome.errors, conflicts: acceptedOutcome.conflicts } : combined;
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
        body, cache: 'no-store', signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      if (attempt < 2) continue;
      throw new SyncRequestError('Nie udało się potwierdzić synchronizacji. Odśwież dane i sprawdź wynik przed ponownym zapisem.', 0, 'outcome_unknown', { cause: error });
    }
    if (response.status >= 500 && attempt < 2) continue;
    if (!response.ok) throw await syncHttpError(response);
    // Reading/parsing a response can fail after the server has committed. Reuse
    // the same request identity, just as for a lost connection during fetch.
    try {
      return parseSyncResponse(await response.json());
    } catch (error) {
      if (attempt < 2) continue;
      throw new SyncRequestError('Nie udało się odczytać wyniku synchronizacji. Odśwież dane przed ponownym zapisem.', 0, 'outcome_unknown', { cause: error });
    }
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
