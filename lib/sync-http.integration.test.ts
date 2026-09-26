// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
const auth = vi.hoisted(() => ({ accessToken: '' }));
vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('./session', () => ({ getSession: async () => auth }));

const url = process.env.SYNC_HTTP_API_URL;
const enabled = url?.startsWith('http://127.0.0.1:') && !!process.env.SYNC_HTTP_EMAIL && !!process.env.SYNC_HTTP_PASSWORD;
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it.runIf(enabled)('reads the Android graph and merges concurrent writes and a lost response over real HTTP', async () => {
  vi.stubEnv('API_URL', url!);
  const login = await fetch(`${url}/api/auth/login/`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.SYNC_HTTP_EMAIL, password: process.env.SYNC_HTTP_PASSWORD }) });
  expect(login.ok).toBe(true);
  auth.accessToken = (await login.json()).access;
  const { fetchSync, postSyncChanges } = await import('./api');
  const initial = (await fetchSync())!;
  expect(initial.server_changes.transactions.length).toBeGreaterThan(250);
  expect(initial.has_more).toBe(false);
  const account = initial.server_changes.accounts.find(a => !a.deleted_at && a.name.startsWith('HTTP ') &&
    initial.server_changes.categories.some(c => !c.deleted_at && c.name === a.name))!;
  const category = initial.server_changes.categories.find(c => !c.deleted_at && c.name === account.name)!;
  const balance = Number(account.balance);
  const ids: string[] = [];
  const mutation = (amount: number) => {
    const id = crypto.randomUUID(); ids.push(id);
    const now = new Date().toISOString();
    return { accounts: [{ ...account, balance: (balance - amount).toFixed(2), updated_at: now }],
      transactions: [{ id, type: 'EXPENSE', total_amount: amount.toFixed(2), from_account_id: account.id,
        account_currency: account.currency, date_time: now, updated_at: now, version: 1, review_status: 'APPROVED' }],
      transaction_splits: [{ id: crypto.randomUUID(), transaction_id: id, category_id: category.id,
        amount: amount.toFixed(2), name: 'HTTP web test', updated_at: now, version: 1 }] };
  };
  const nativeFetch = globalThis.fetch;
  const sentBodies: string[] = [];
  let lose = true;
  vi.stubGlobal('fetch', async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const response = await nativeFetch(input, init);
    if (String(input).endsWith('/api/sync/')) {
      sentBodies.push(String(init?.body));
      if (lose) { lose = false; await response.arrayBuffer(); throw new TypeError('Lost response after commit'); }
    }
    return response;
  });
  await postSyncChanges(mutation(1));
  expect(sentBodies[0]).toBe(sentBodies[1]);
  await Promise.all([postSyncChanges(mutation(2)), postSyncChanges(mutation(3))]);
  const final = (await fetchSync())!;
  expect(Number(final.server_changes.accounts.find(a => a.id === account.id)!.balance)).toBeCloseTo(balance - 6, 2);
  for (const id of ids) expect(final.server_changes.transactions.filter(t => t.id === id)).toHaveLength(1);
}, 90000);

it.runIf(enabled)('preserves and resolves incomplete history across real paged v3 sync without balance drift', async () => {
  vi.stubEnv('API_URL', url!);
  const login = await fetch(`${url}/api/auth/login/`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.SYNC_HTTP_EMAIL, password: process.env.SYNC_HTTP_PASSWORD }) });
  expect(login.ok).toBe(true);
  auth.accessToken = (await login.json()).access;
  const { fetchSync, postSyncChanges } = await import('./api');
  const before = (await fetchSync())!;
  const template = before.server_changes.transactions.find(t => t.account_link_state === 'MISSING_DESTINATION')!;
  expect(template).toBeTruthy();
  const source = before.server_changes.accounts.find(a => a.id === template.from_account_id)!;
  const destination = before.server_changes.accounts.find(a => !a.deleted_at && a.id !== source.id && a.currency === template.to_account_currency)!;
  expect(destination).toBeTruthy();
  const balanceBefore = Number(destination.balance);
  const id = crypto.randomUUID();
  const created = (await postSyncChanges({ transactions: [{ ...template, id, version: 1, notes: 'Synthetic v3 resolution test', updated_at: new Date().toISOString() }] }, before.sync_reset_generation))!;
  expect(created.errors).toEqual([]);
  const row = created.server_changes.transactions.find(t => t.id === id)!;
  expect(row.account_link_state).toBe('MISSING_DESTINATION');
  expect(row.to_account_amount).toBe(template.to_account_amount);
  expect(Number(created.server_changes.accounts.find(a => a.id === destination.id)!.balance)).toBeCloseTo(balanceBefore, 2);
  const noted = (await postSyncChanges({ transactions: [{ ...row, notes: 'Updated note', updated_at: new Date().toISOString() }] }, created.sync_reset_generation))!;
  expect(noted.errors).toEqual([]);
  expect(Number(noted.server_changes.accounts.find(a => a.id === destination.id)!.balance)).toBeCloseTo(balanceBefore, 2);
  const current = noted.server_changes.transactions.find(t => t.id === id)!;
  const resolved = (await postSyncChanges({ transactions: [{ ...current, to_account_id: destination.id, account_link_state: 'COMPLETE', missing_destination_reason: null, updated_at: new Date().toISOString() }] }, noted.sync_reset_generation))!;
  expect(resolved.errors).toEqual([]);
  expect(Number(resolved.server_changes.accounts.find(a => a.id === destination.id)!.balance)).toBeCloseTo(balanceBefore + Number(template.to_account_amount), 2);
  // A second upload of the stale history must not undo the resolved destination.
  const stale = (await postSyncChanges({ transactions: [{ ...current, updated_at: new Date().toISOString() }] }, resolved.sync_reset_generation))!;
  expect(stale.conflicts.some(c => c.id === id && c.resolution === 'server_wins')).toBe(true);
  expect(Number(stale.server_changes.accounts.find(a => a.id === destination.id)!.balance)).toBeCloseTo(balanceBefore + Number(template.to_account_amount), 2);
}, 90000);
