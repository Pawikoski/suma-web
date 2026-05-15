'use client';
import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { addMonths, format, parse } from 'date-fns';
import { pl } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Eye, EyeOff, Search } from 'lucide-react';
import { T } from '@/lib/tokens';
import { useSumaUiStore } from '@/lib/stores/ui-store';
import { useActiveMonthData } from '@/lib/useActiveMonthData';

const TITLES: Record<string, string> = {
  '/':              'Home',
  '/transactions':  'Transakcje',
  '/calendar':      'Kalendarz',
  '/recurring':     'Opłaty stałe',
  '/settlements':   'Rozliczenia',
  '/categories':    'Kategorie',
  '/accounts':      'Konta',
  '/investments':   'Inwestycje',
  '/budget':        'Budżet',
  '/reports':       'Raporty',
  '/import-export': 'Import/eksport',
  '/settings':      'Ustawienia',
};

interface TopbarProps {
  subtitle?: string;
  actions?: ReactNode;
}

export default function Topbar({ subtitle, actions }: TopbarProps) {
  const pathname = usePathname();
  const title = TITLES[pathname] ?? (
    pathname.startsWith('/categories/') ? 'Szczegóły kategorii'
      : pathname.startsWith('/accounts/') ? 'Szczegóły konta'
        : pathname.startsWith('/investments/') ? 'Szczegóły inwestycji'
          : pathname.startsWith('/settings/') ? 'Ustawienia'
            : ''
  );
  const openCommand = useSumaUiStore(state => state.openCommand);
  const privacyMode = useSumaUiStore(state => state.privacyMode);
  const togglePrivacyMode = useSumaUiStore(state => state.togglePrivacyMode);
  const { activeMonth, setActiveMonthParam } = useActiveMonthData();
  const parsedMonth = parse(activeMonth, 'yyyy-MM', new Date());
  const monthLabel = activeMonth === 'all'
    ? 'Wszystkie'
    : format(parsedMonth, 'LLLL yyyy', { locale: pl });
  const shiftMonth = (delta: number) => {
    if (activeMonth === 'all') return;
    void setActiveMonthParam(format(addMonths(parsedMonth, delta), 'yyyy-MM'));
  };

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

      <div className="month-switcher" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: 4, borderRadius: 10, background: T.bg }}>
        <button
          aria-label="Poprzedni miesiąc"
          onClick={() => shiftMonth(-1)}
          disabled={activeMonth === 'all'}
          style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.muted, opacity: activeMonth === 'all' ? 0.4 : 1 }}
        >
          <ChevronLeft size={17} />
        </button>
        <button
          aria-label="Wybierz wszystkie miesiące"
          onClick={() => void setActiveMonthParam(activeMonth === 'all' ? null : 'all')}
          style={{ minWidth: 118, height: 30, padding: '0 8px', borderRadius: 8, color: T.mid, fontWeight: 800, fontSize: 13, textTransform: 'capitalize' }}
        >
          {monthLabel}
        </button>
        <button
          aria-label="Następny miesiąc"
          onClick={() => shiftMonth(1)}
          disabled={activeMonth === 'all'}
          style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.muted, opacity: activeMonth === 'all' ? 0.4 : 1 }}
        >
          <ChevronRight size={17} />
        </button>
      </div>

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
