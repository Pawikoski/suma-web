import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/session', () => ({ getSession: vi.fn() }));

import { getSession } from '@/lib/session';
import { suggestCategoryIconAction } from './category-icons';

describe('suggestCategoryIconAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.API_URL = 'https://api.example.test/';
    vi.mocked(getSession).mockResolvedValue({
      userId: '1', email: 'user@example.test', accessToken: 'test-token', refreshToken: 'refresh-token',
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('returns a catalog icon from the authenticated API response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ icon_name: 'shopping_cart', icon_bg: '#DBEAFE', icon_color: '#3B82F6' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await suggestCategoryIconAction({ name: 'Zakupy', types: ['EXPENSE'] });

    expect(result).toEqual({ ok: true, iconName: 'ShoppingCart', iconBg: '#DBEAFE', iconColor: '#3B82F6' });
    expect(fetchMock).toHaveBeenCalledWith('https://api.example.test/api/categories/suggest-icon/',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
        body: JSON.stringify({ name: 'Zakupy', types: ['EXPENSE'] }),
      }));
  });

  it('rejects unknown icons before updating the form', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ icon_name: 'not_real', icon_bg: '#DBEAFE', icon_color: '#3B82F6' }),
    }));

    expect(await suggestCategoryIconAction({ name: 'Zakupy', types: ['EXPENSE'] })).toEqual({ ok: false });
  });
});
