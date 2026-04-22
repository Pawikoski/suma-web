'use client';
import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Search, Bell } from 'lucide-react';
import { T } from '@/lib/tokens';

const TITLES: Record<string, string> = {
  '/':              'Home',
  '/transactions':  'Transakcje',
  '/categories':    'Kategorie',
  '/accounts':      'Konta',
  '/budget':        'Budżet',
};

interface TopbarProps {
  subtitle?: string;
  actions?: ReactNode;
}

export default function Topbar({ subtitle, actions }: TopbarProps) {
  const pathname = usePathname();
  const title = TITLES[pathname] ?? '';

  return (
    <div style={{
      height: 60, background: T.card, borderBottom: `1px solid ${T.border}`,
      display: 'flex', alignItems: 'center', paddingLeft: 24, paddingRight: 20, gap: 16,
      position: 'sticky', top: 0, zIndex: 50,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: T.dark }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: T.muted }}>{subtitle}</div>}
      </div>

      {actions}

      <button style={{ width: 34, height: 34, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.bg, color: T.muted, border: 'none', cursor: 'pointer' }}>
        <Search size={16} />
      </button>
      <button style={{ width: 34, height: 34, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.bg, color: T.muted, border: 'none', cursor: 'pointer', position: 'relative' }}>
        <Bell size={16} />
        <span style={{ position: 'absolute', top: 7, right: 7, width: 6, height: 6, borderRadius: '50%', background: T.expense, border: `1.5px solid ${T.card}` }} />
      </button>
    </div>
  );
}
