'use client';

import { useActionState } from 'react';
import { T } from '@/lib/tokens';
import { resetPassword, type ResetPasswordState } from './actions';

const initialState: ResetPasswordState = { status: 'idle', message: '' };

export default function ResetPasswordForm({ uid, token }: { uid: string; token: string }) {
  const [state, formAction, pending] = useActionState(resetPassword, initialState);
  const missingLinkData = !uid || !token;

  return (
    <div style={{ width: '100%', maxWidth: 420 }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 36, fontWeight: 800, color: T.accent, marginBottom: 4 }}>Σ Suma</div>
        <h1 style={{ margin: 0, fontSize: 22, color: T.dark }}>Reset hasła</h1>
        <p style={{ margin: '8px 0 0', fontSize: 14, color: T.muted }}>
          Ustaw nowe hasło do konta Suma.
        </p>
      </div>

      {missingLinkData ? (
        <StatusMessage tone="error" message="Link resetu jest niekompletny. Otwórz najnowszy link z wiadomości e-mail." />
      ) : (
        <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input type="hidden" name="uid" value={uid} />
          <input type="hidden" name="token" value={token} />

          <PasswordField name="password1" label="Nowe hasło" autoComplete="new-password" />
          <PasswordField name="password2" label="Powtórz hasło" autoComplete="new-password" />

          {state.message && (
            <StatusMessage
              tone={state.status === 'success' ? 'success' : 'error'}
              message={state.message}
            />
          )}

          <button
            type="submit"
            disabled={pending || state.status === 'success'}
            style={{
              padding: '11px 14px',
              borderRadius: T.radiusSm,
              background: T.accent,
              color: 'white',
              fontWeight: 600,
              fontSize: 14,
              border: 'none',
              cursor: pending || state.status === 'success' ? 'not-allowed' : 'pointer',
              opacity: pending || state.status === 'success' ? 0.7 : 1,
              marginTop: 4,
              fontFamily: 'inherit',
            }}
          >
            {pending ? 'Zapisywanie...' : 'Zmień hasło'}
          </button>
        </form>
      )}
    </div>
  );
}

function PasswordField({
  name,
  label,
  autoComplete,
}: {
  name: string;
  label: string;
  autoComplete: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: T.mid }}>{label}</label>
      <input
        name={name}
        type="password"
        required
        autoComplete={autoComplete}
        style={{
          padding: '10px 14px',
          borderRadius: T.radiusSm,
          border: `1px solid ${T.border}`,
          fontSize: 14,
          outline: 'none',
          color: T.dark,
          fontFamily: 'inherit',
        }}
      />
    </div>
  );
}

function StatusMessage({ tone, message }: { tone: 'success' | 'error'; message: string }) {
  return (
    <div
      style={{
        padding: '10px 14px',
        borderRadius: T.radiusSm,
        background: tone === 'success' ? '#dcfce7' : '#fee2e2',
        color: tone === 'success' ? '#166534' : T.expense,
        fontSize: 13,
        lineHeight: 1.4,
      }}
    >
      {message}
    </div>
  );
}
