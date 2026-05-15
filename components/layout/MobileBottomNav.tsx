'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart2, ClipboardList, Home, Plus, Repeat2, Tag, Wallet } from 'lucide-react';
import { T } from '@/lib/tokens';
import { useActiveMonthData } from '@/lib/useActiveMonthData';

const NAV = [
  { href: '/', label: 'Home', Icon: Home },
  { href: '/transactions', label: 'Transakcje', Icon: ClipboardList },
  { href: '/recurring', label: 'Stałe', Icon: Repeat2 },
  { href: '/categories', label: 'Kategorie', Icon: Tag },
  { href: '/accounts', label: 'Konta', Icon: Wallet },
  { href: '/budget', label: 'Budżet', Icon: BarChart2 },
] as const;

export default function MobileBottomNav({ onAdd }: { onAdd: () => void }) {
  const pathname = usePathname();
  const { activeMonth } = useActiveMonthData();
  const navHref = (href: string) => `${href}?month=${encodeURIComponent(activeMonth)}`;
  const left = NAV.slice(0, 2);
  const right = NAV.slice(2);

  return (
    <nav className="mobile-bottom-nav" aria-label="Główna nawigacja">
      {[...left].map(({ href, label, Icon }) => {
        const active = pathname === href;
        return (
          <Link key={href} href={navHref(href)} className={`mobile-nav-item${active ? ' active' : ''}`} aria-label={label}>
            <Icon size={active ? 22 : 24} color={active ? T.accent : T.muted} />
            {active && <span>{label}</span>}
          </Link>
        );
      })}

      <button type="button" className="mobile-nav-fab" onClick={onAdd} aria-label="Dodaj transakcję">
        <Plus size={26} color="white" />
      </button>

      {[...right].map(({ href, label, Icon }) => {
        const active = pathname === href;
        return (
          <Link key={href} href={navHref(href)} className={`mobile-nav-item${active ? ' active' : ''}`} aria-label={label}>
            <Icon size={active ? 22 : 24} color={active ? T.accent : T.muted} />
            {active && <span>{label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
