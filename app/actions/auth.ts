'use server';
import { redirect } from 'next/navigation';
import { createSession, deleteSession } from '@/lib/session';

const API_URL = process.env.API_URL!;

export async function loginWithEmail(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) return 'Podaj email i hasło.';

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    return 'Nie można połączyć się z serwerem.';
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = body?.non_field_errors?.[0] ?? body?.detail ?? 'Błędne dane logowania.';
    return detail;
  }

  const data = await res.json();
  await createSession({
    userId: String(data.user?.pk ?? data.user?.id ?? ''),
    email: data.user?.email ?? email,
    accessToken: data.access,
    refreshToken: data.refresh,
  });

  redirect('/');
}

export async function loginWithGoogle(idToken: string): Promise<string | null> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/auth/google/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_token: idToken }),
    });
  } catch {
    return 'Nie można połączyć się z serwerem.';
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return body?.error ?? 'Błąd logowania przez Google.';
  }

  const data = await res.json();
  await createSession({
    userId: String(data.user?.pk ?? data.user?.id ?? ''),
    email: data.user?.email ?? '',
    accessToken: data.access,
    refreshToken: data.refresh,
  });

  redirect('/');
}

export async function logout(): Promise<void> {
  await deleteSession();
  redirect('/login');
}
