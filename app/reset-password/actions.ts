'use server';

export type ResetPasswordState = {
  status: 'idle' | 'success' | 'error';
  message: string;
};

const API_URL = process.env.API_URL!;

export async function resetPassword(
  _prevState: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const uid = String(formData.get('uid') ?? '');
  const token = String(formData.get('token') ?? '');
  const password1 = String(formData.get('password1') ?? '');
  const password2 = String(formData.get('password2') ?? '');

  if (!uid || !token) {
    return { status: 'error', message: 'Link resetu jest niekompletny.' };
  }
  if (!password1 || !password2) {
    return { status: 'error', message: 'Podaj i potwierdź nowe hasło.' };
  }
  if (password1 !== password2) {
    return { status: 'error', message: 'Hasła nie są takie same.' };
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/auth/password/reset/confirm/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, token, password1, password2 }),
    });
  } catch {
    return { status: 'error', message: 'Nie można połączyć się z serwerem.' };
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const detail =
      body?.password1?.[0] ??
      body?.password2?.[0] ??
      body?.detail ??
      'Nie udało się zresetować hasła.';
    return { status: 'error', message: detail };
  }

  return {
    status: 'success',
    message: 'Hasło zostało zmienione. Możesz wrócić do aplikacji i zalogować się nowym hasłem.',
  };
}
