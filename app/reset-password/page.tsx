import { T } from '@/lib/tokens';
import ResetPasswordForm from './ResetPasswordForm';

export const metadata = { title: 'Reset hasła - Suma' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ResetPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const uid = firstParam(params.uid);
  const token = firstParam(params.token);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: T.bg,
        padding: 24,
      }}
    >
      <div
        style={{
          background: T.card,
          borderRadius: T.radius,
          border: `1px solid ${T.border}`,
          padding: '40px 36px',
          width: '100%',
          maxWidth: 440,
          boxShadow: '0 4px 24px rgba(0,0,0,.06)',
        }}
      >
        <ResetPasswordForm uid={uid} token={token} />
      </div>
    </div>
  );
}

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}
