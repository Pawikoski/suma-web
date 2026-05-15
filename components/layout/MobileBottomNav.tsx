'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { BarChart2, CalendarDays, ClipboardList, HandCoins, Home, LineChart, MoreHorizontal, Plus, Repeat2, Settings, Tag, UploadCloud, Wallet } from 'lucide-react';
import { T } from '@/lib/tokens';
import { useActiveMonthData } from '@/lib/useActiveMonthData';

const NAV = [
  { href: '/', label: 'Home', Icon: Home },
  { href: '/transactions', label: 'Transakcje', Icon: ClipboardList },
  { href: '/categories', label: 'Kategorie', Icon: Tag },
  { href: '/accounts', label: 'Konta', Icon: Wallet },
  { href: '/budget', label: 'Budżet', Icon: BarChart2 },
] as const;

const MORE_NAV = [
  { href: '/calendar', label: 'Kalendarz', Icon: CalendarDays },
  { href: '/recurring', label: 'Opłaty stałe', Icon: Repeat2 },
  { href: '/settlements', label: 'Rozliczenia', Icon: HandCoins },
  { href: '/investments', label: 'Inwestycje', Icon: LineChart },
  { href: '/reports', label: 'Raporty', Icon: BarChart2 },
  { href: '/import-export', label: 'Import/eksport', Icon: UploadCloud },
  { href: '/settings', label: 'Ustawienia', Icon: Settings },
] as const;

export default function MobileBottomNav({ onAdd }: { onAdd: () => void }) {
  const pathname = usePathname();
  const { activeMonth } = useActiveMonthData();
  const [moreOpen, setMoreOpen] = useState(false);
  const navHref = (href: string) => `${href}?month=${encodeURIComponent(activeMonth)}`;
  const left = NAV.slice(0, 2);
  const right = NAV.slice(2);
  const moreActive = MORE_NAV.some(item => item.href === pathname || pathname.startsWith(`${item.href}/`));

  return (
    <nav className="mobile-bottom-nav" aria-label="Główna nawigacja">
      {moreOpen && (
        <div className="mobile-more-menu" role="menu" aria-label="Więcej ekranów">
          {MORE_NAV.map(({ href, label, Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={navHref(href)}
                role="menuitem"
                className={`mobile-more-item${active ? ' active' : ''}`}
                onClick={() => setMoreOpen(false)}
              >
                <Icon size={18} color={active ? T.accent : T.muted} />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      )}

      {[...left].map(({ href, label, Icon }) => {
        const active = pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));
        return (
          <Link key={href} href={navHref(href)} onClick={() => setMoreOpen(false)} className={`mobile-nav-item${active ? ' active' : ''}`} aria-label={label}>
            <Icon size={active ? 22 : 24} color={active ? T.accent : T.muted} />
            {active && <span>{label}</span>}
          </Link>
        );
      })}

      <button type="button" className="mobile-nav-fab" onClick={onAdd} aria-label="Dodaj transakcję">
        <Plus size={26} color="white" />
      </button>

      {[...right].map(({ href, label, Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link key={href} href={navHref(href)} onClick={() => setMoreOpen(false)} className={`mobile-nav-item${active ? ' active' : ''}`} aria-label={label}>
            <Icon size={active ? 22 : 24} color={active ? T.accent : T.muted} />
            {active && <span>{label}</span>}
          </Link>
        );
      })}
      <button type="button" className={`mobile-nav-item mobile-more-button${moreActive || moreOpen ? ' active' : ''}`} onClick={() => setMoreOpen(open => !open)} aria-label="Więcej">
        <MoreHorizontal size={moreActive || moreOpen ? 22 : 24} color={moreActive || moreOpen ? T.accent : T.muted} />
        {(moreActive || moreOpen) && <span>Więcej</span>}
      </button>
    </nav>
  );
}
