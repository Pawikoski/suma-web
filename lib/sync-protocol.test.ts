// Sync protocol regression tests.
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('./session', () => ({ getSession: async () => ({ accessToken: 'audit-only' }) }));
import { fetchSync, postSyncChanges } from './api';
import { parseSyncResponse } from './schemas/sync';

const empty = { accounts: [], categories: [], transactions: [], transaction_splits: [],
  category_budgets: [], overall_budgets: [] };
const page = { request_id: 'audit', new_sync_token: null, has_more: true,
  next_restore_cursor: 250, restore_sync_token: '500', server_changes: empty };

afterEach(() => vi.unstubAllGlobals());

it('accepts the API first page with a null final token', () => {
  expect(() => parseSyncResponse(page)).not.toThrow();
});

it('fetches all pages before returning a financial snapshot', async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => page })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ ...page,
      new_sync_token: '500', has_more: false, next_restore_cursor: null }) });
  vi.stubGlobal('fetch', fetchMock);
  await expect(fetchSync()).resolves.toBeTruthy();
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it('retries a lost response with identical request id and payload', async () => {
  const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError('connection lost'))
    .mockResolvedValueOnce({ ok: true, json: async () => ({ ...page, new_sync_token: '500', has_more: false }) });
  vi.stubGlobal('fetch', fetchMock);
  await fetchSync();
  expect(fetchMock.mock.calls[0][1].body).toBe(fetchMock.mock.calls[1][1].body);
});

it('acknowledges reset generation before restoring the snapshot', async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ ...page, has_more: false,
      reset_required: true, sync_reset_generation: 7 }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ ...page, new_sync_token: '8',
      has_more: false, sync_reset_generation: 7 }) });
  vi.stubGlobal('fetch', fetchMock);
  expect((await fetchSync())?.new_sync_token).toBe('8');
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).sync_reset_generation).toBe(7);
});

it('declares v3 even for the first read', async () => {
  const mock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ...page, new_sync_token: '500', has_more: false }) });
  vi.stubGlobal('fetch', mock);
  await fetchSync();
  expect(JSON.parse(mock.mock.calls[0][1].body).schema_version).toBe(3);
});

it.each([400, 409, 429])('does not retry permanent HTTP %s and hides response data', async status => {
  const mock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: status === 409 ? 'sync_client_upgrade_required' : 'validation', detail: 'PRIVATE FINANCIAL DATA' }), { status }));
  vi.stubGlobal('fetch', mock);
  await expect(fetchSync()).rejects.toMatchObject({ status });
  expect(mock).toHaveBeenCalledTimes(1);
});

it('replays exactly the same mutation when reading the committed response fails', async () => {
  const mock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => { throw new TypeError('body lost'); } })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ ...page, new_sync_token: '500', has_more: false }) });
  vi.stubGlobal('fetch', mock);
  await postSyncChanges({ transactions: [{ id: 'new' }] });
  expect(mock.mock.calls[0][1].body).toBe(mock.mock.calls[1][1].body);
});

it('retains rejected mutation outcome when concurrent changes restart the paged snapshot', async () => {
  const conflicts = [{ model: 'core.Transaction', id: 'tx', resolution: 'server_wins' }];
  const mock = vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ ...page, conflicts }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ ...page, sync_token_expired: true }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ ...page, new_sync_token: '501', has_more: false }) });
  vi.stubGlobal('fetch', mock);
  expect((await postSyncChanges({ transactions: [{ id: 'tx' }] }))?.conflicts).toEqual(conflicts);
  expect(JSON.parse(mock.mock.calls[2][1].body).changes).toEqual({});
});

it('rejects a restore cursor loop instead of returning a partial graph', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => page }));
  await expect(fetchSync()).rejects.toThrow('nie przesuwa kursora');
});

it('rejects an unknown history state instead of silently dropping its meaning', () => {
  expect(() => parseSyncResponse({ ...page, server_changes: { ...empty, transactions: [{ account_link_state: 'FUTURE_STATE' }] } })).toThrow();
});

it('never replays a stale mutation across a cloud reset', async () => {
  const mock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ...page, reset_required: true, sync_reset_generation: 8 }) });
  vi.stubGlobal('fetch', mock);
  await expect(postSyncChanges({ transactions: [{ id: 'old' }] }, 7)).rejects.toMatchObject({ code: 'sync_reset_required' });
  expect(mock).toHaveBeenCalledTimes(1);
  expect(JSON.parse(mock.mock.calls[0][1].body).sync_reset_generation).toBe(7);
});

it('retains uncertain-write status if a later snapshot page is rejected after commit', async () => {
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => page })
    .mockResolvedValueOnce(new Response('{}', { status: 400 })));
  await expect(postSyncChanges({ transactions: [{ id: 'committed' }] }, 0)).rejects.toMatchObject({ code: 'outcome_unknown' });
});
