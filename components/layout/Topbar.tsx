'use client';
import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Search, Eye, EyeOff } from 'lucide-react';
import { T } from '@/lib/tokens';
import { useSumaUiStore } from '@/lib/stores/ui-store';

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
  const openCommand = useSumaUiStore(state => state.openCommand);
  const privacyMode = useSumaUiStore(state => state.privacyMode);
  const togglePrivacyMode = useSumaUiStore(state => state.togglePrivacyMode);

  return (
    <div className="topbar" style={{
      height: 68, background: T.card, borderBottom: `1px solid ${T.border}`,
      display: 'flex', alignItems: 'center', paddingLeft: 24, paddingRight: 20, gap: 16,
      position: 'sticky', top: 0, zIndex: 50,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: T.dark }}>{title}</div>
        {subtitle && <div style={{ fontSize: 14, color: T.muted }}>{subtitle}</div>}
      </div>

      {actions}

      <button
        aria-label="Szukaj"
        onClick={openCommand}
        style={{ width: 40, height: 40, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.bg, color: T.muted, border: 'none', cursor: 'pointer' }}
      >
        <Search size={18} />
      </button>
      <button
        aria-label={privacyMode ? 'Pokaż kwoty' : 'Ukryj kwoty'}
        onClick={togglePrivacyMode}
        style={{ width: 40, height: 40, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: privacyMode ? T.accentLight : T.bg, color: privacyMode ? T.accent : T.muted, border: 'none', cursor: 'pointer' }}
      >
        {privacyMode ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
