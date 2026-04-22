import { T } from '@/lib/tokens';
import LoginForm from './LoginForm';

export const metadata = { title: 'Logowanie – Suma' };

export default function LoginPage() {
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
          maxWidth: 400,
          boxShadow: '0 4px 24px rgba(0,0,0,.06)',
        }}
      >
        <LoginForm />
      </div>
    </div>
  );
}
