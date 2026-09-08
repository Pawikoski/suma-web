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
  const account = initial.server_changes.accounts.find(a => !a.deleted_at && a.name.startsWith('HTTP '))!;
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
