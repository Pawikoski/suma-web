// Sync protocol regression tests.
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('./session', () => ({ getSession: async () => ({ accessToken: 'audit-only' }) }));
import { fetchSync } from './api';
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
