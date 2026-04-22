'use client';
import { useActionState, useTransition } from 'react';
import { loginWithEmail, loginWithGoogle } from '@/app/actions/auth';
import { T } from '@/lib/tokens';

export default function LoginForm() {
  const [error, formAction, pending] = useActionState(loginWithEmail, null);
  const [googlePending, startGoogleTransition] = useTransition();

  function handleGoogleResponse(response: { credential: string }) {
    startGoogleTransition(async () => {
      await loginWithGoogle(response.credential);
    });
  }

  // Expose handler for GSI callback
  if (typeof window !== 'undefined') {
    (window as unknown as Record<string, unknown>).__sumaGoogleHandler = handleGoogleResponse;
  }

  return (
    <div style={{ width: '100%', maxWidth: 400 }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 40, fontWeight: 800, color: T.accent, letterSpacing: '-2px', marginBottom: 4 }}>Σ Suma</div>
        <div style={{ fontSize: 14, color: T.muted }}>Zaloguj się do swojego konta</div>
      </div>

      <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: T.mid }}>Email</label>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="jan@kowalski.pl"
            style={{
              padding: '10px 14px', borderRadius: T.radiusSm, border: `1px solid ${T.border}`,
              fontSize: 14, outline: 'none', color: T.dark, fontFamily: 'inherit',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: T.mid }}>Hasło</label>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            style={{
              padding: '10px 14px', borderRadius: T.radiusSm, border: `1px solid ${T.border}`,
              fontSize: 14, outline: 'none', color: T.dark, fontFamily: 'inherit',
            }}
          />
        </div>

        {error && (
          <div style={{ padding: '10px 14px', borderRadius: T.radiusSm, background: '#fee2e2', color: T.expense, fontSize: 13 }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          style={{
            padding: '11px 14px', borderRadius: T.radiusSm, background: T.accent, color: 'white',
            fontWeight: 600, fontSize: 14, border: 'none', cursor: pending ? 'not-allowed' : 'pointer',
            opacity: pending ? 0.7 : 1, marginTop: 4, fontFamily: 'inherit',
          }}
        >
          {pending ? 'Logowanie…' : 'Zaloguj się'}
        </button>
      </form>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
        <div style={{ flex: 1, height: 1, background: T.border }} />
        <span style={{ fontSize: 12, color: T.muted }}>lub</span>
        <div style={{ flex: 1, height: 1, background: T.border }} />
      </div>

      <GoogleSignInButton disabled={googlePending} />
    </div>
  );
}

function GoogleSignInButton({ disabled }: { disabled: boolean }) {
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  if (!googleClientId || googleClientId.includes('twoj-')) {
    return null;
  }

  return (
    <>
      <script
        src="https://accounts.google.com/gsi/client"
        async
        defer
      />
      <div
        id="g_id_onload"
        data-client_id={googleClientId}
        data-callback="__sumaGoogleHandler"
        data-auto_prompt="false"
      />
      <div
        className="g_id_signin"
        data-type="standard"
        data-shape="rectangular"
        data-theme="outline"
        data-text="signin_with"
        data-size="large"
        data-locale="pl"
        style={{ opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto' }}
      />
    </>
  );
}
