import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { importAnalysisSchema } from '@/lib/schemas/import-analysis';

const API_URL = process.env.API_URL!;

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.accessToken) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ detail: 'Wybierz plik do analizy.' }, { status: 400 });
  }

  const upstreamForm = new FormData();
  upstreamForm.set('file', file, file.name);

  const upstream = await fetch(`${API_URL}/api/imports/analyze/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
    },
    body: upstreamForm,
    cache: 'no-store',
  });

  const payload = await upstream.json().catch(() => null);
  if (!upstream.ok) {
    return NextResponse.json(payload ?? { detail: `Import analysis failed with ${upstream.status}` }, { status: upstream.status });
  }

  const parsed = importAnalysisSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ detail: 'API zwróciło niepoprawny format analizy importu.' }, { status: 502 });
  }

  return NextResponse.json(parsed.data);
}
