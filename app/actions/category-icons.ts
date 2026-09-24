'use server';

import { z } from 'zod';
import { getSession } from '@/lib/session';
import { normalizeCategoryIconName } from '@/lib/category-icons';

const requestSchema = z.object({
  name: z.string().trim().min(2).max(120),
  types: z.array(z.enum(['EXPENSE', 'INCOME'])).min(1).max(2),
});

const suggestionSchema = z.object({
  icon_name: z.string(),
  icon_bg: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  icon_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export async function suggestCategoryIconAction(input: unknown) {
  const request = requestSchema.safeParse(input);
  if (!request.success) return { ok: false as const };
  const session = await getSession();
  if (!session || !process.env.API_URL) return { ok: false as const };

  try {
    const response = await fetch(`${process.env.API_URL?.replace(/\/$/, '')}/api/categories/suggest-icon/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessToken}` },
      body: JSON.stringify(request.data),
      cache: 'no-store',
    });
    if (!response.ok) return { ok: false as const };
    const suggestion = suggestionSchema.parse(await response.json());
    const iconName = normalizeCategoryIconName(suggestion.icon_name);
    if (!iconName) return { ok: false as const };
    return {
      ok: true as const,
      iconName,
      iconBg: suggestion.icon_bg,
      iconColor: suggestion.icon_color,
    };
  } catch {
    return { ok: false as const };
  }
}
