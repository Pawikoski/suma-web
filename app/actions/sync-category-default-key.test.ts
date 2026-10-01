import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/api', () => ({ fetchSync: vi.fn(), postSyncChanges: vi.fn() }));
import { fetchSync, postSyncChanges } from '@/lib/api';
import { parseSyncResponse } from '@/lib/schemas/sync';
import { updateCategoryAction } from './sync';

// N-38: an untouched default category keeps its key; a rename on the web freezes the name.
const time = '2026-09-08T09:37:12Z';
const base = { updated_at: time, deleted_at: null, version: 3 };
const category = (extra: Record<string, unknown> = {}) => ({ ...base, id: 'groceries', name: 'Groceries',
  types: ['EXPENSE'], icon_name: 'ShoppingCart', icon_bg: '#FCE7F3', icon_color: '#EC4899', sort_order: 0,
  is_default: false, is_system: false, ...extra });
const snapshot = (extra?: Record<string, unknown>) => parseSyncResponse({ request_id: 'read', new_sync_token: '3',
  server_changes: { accounts: [], categories: [category(extra)], transactions: [], transaction_splits: [],
    category_budgets: [], overall_budgets: [] } });
const edit = (name: string) => updateCategoryAction({ id: 'groceries', name, types: ['EXPENSE'],
  iconName: 'ShoppingCart', iconBg: '#FCE7F3', iconColor: '#EC4899', parentCategoryId: null });
const sentCategory = () => (vi.mocked(postSyncChanges).mock.calls[0][0] as { categories: Array<Record<string, unknown>> })
  .categories[0];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(postSyncChanges).mockResolvedValue(parseSyncResponse({ request_id: 'write', new_sync_token: '4',
    server_changes: { accounts: [], categories: [], transactions: [], transaction_splits: [], category_budgets: [],
      overall_budgets: [] } }));
});

it('reads the key and treats an older server (no key) as a custom category', () => {
  expect(snapshot({ default_key: 'groceries' }).server_changes.categories[0].default_key).toBe('groceries');
  expect(snapshot().server_changes.categories[0].default_key).toBe('');
});

it('keeps the key when the category is edited without renaming it', async () => {
  vi.mocked(fetchSync).mockResolvedValue(snapshot({ default_key: 'groceries' }));

  expect((await edit('Groceries')).ok).toBe(true);

  expect(sentCategory().default_key).toBe('groceries');
});

it('clears the key when the category is renamed', async () => {
  vi.mocked(fetchSync).mockResolvedValue(snapshot({ default_key: 'groceries' }));

  expect((await edit('Spożywcze')).ok).toBe(true);

  expect(sentCategory().default_key).toBe('');
});
