'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ClipboardList, Tag, Wallet, BarChart2, Plus, LogOut, Repeat2, UploadCloud, HandCoins } from 'lucide-react';
import { format, parse } from 'date-fns';
import { pl } from 'date-fns/locale';
import { logout } from '@/app/actions/auth';
import { T } from '@/lib/tokens';
import { useActiveMonthData } from '@/lib/useActiveMonthData';

const NAV = [
  { href: '/',              label: 'Home',       Icon: Home },
  { href: '/transactions',  label: 'Transakcje', Icon: ClipboardList },
  { href: '/recurring',     label: 'Opłaty stałe', Icon: Repeat2 },
  { href: '/settlements',   label: 'Rozliczenia', Icon: HandCoins },
  { href: '/categories',    label: 'Kategorie',  Icon: Tag },
  { href: '/accounts',      label: 'Konta',      Icon: Wallet },
  { href: '/budget',        label: 'Budżet',     Icon: BarChart2 },
  { href: '/import-export', label: 'Import/eksport', Icon: UploadCloud },
] as const;

interface SidebarProps {
  onAdd: () => void;
}

export default function Sidebar({ onAdd }: SidebarProps) {
  const pathname = usePathname();
  const { userEmail, activeMonth } = useActiveMonthData();
  const activeMonthLabel = activeMonth === 'all'
    ? 'wszystkie miesiące'
    : format(parse(activeMonth, 'yyyy-MM', new Date()), 'LLLL yyyy', { locale: pl });
  const displayEmail = userEmail ?? 'Konto Suma';
  const initials = displayEmail.slice(0, 2).toUpperCase();
  const navHref = (href: string) => `${href}?month=${encodeURIComponent(activeMonth)}`;

  return (
    <div className="app-sidebar" style={{
      width: T.sidebarW, background: T.sidebar,
      borderRight: `1px solid ${T.border}`,
      display: 'flex', flexDirection: 'column',
      height: '100vh', position: 'fixed', left: 0, top: 0, zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{ padding: '24px 20px 16px', borderBottom: `1px solid ${T.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10, background: T.accent,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: 20, fontWeight: 800, letterSpacing: -1,
          }}>Σ</div>
          <span style={{ fontSize: 21, fontWeight: 800, color: T.dark, letterSpacing: '-0.5px' }}>Suma</span>
        </div>
        <div style={{ fontSize: 13, color: T.muted, marginTop: 6, marginLeft: 48 }}>{activeMonthLabel}</div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV.map(({ href, label, Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={navHref(href)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '11px 12px', borderRadius: T.radiusSm,
                background: isActive ? T.accentLight : 'transparent',
                color: isActive ? T.accent : T.mid,
                fontWeight: isActive ? 600 : 400, fontSize: 16,
                transition: 'all .15s', textDecoration: 'none',
              }}
            >
              <Icon size={20} color={isActive ? T.accent : T.muted} />
              {label}
            </Link>
          );
        })}

        <div style={{ marginTop: 12, borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
          <button
            onClick={onAdd}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 12px', borderRadius: T.radiusSm,
              background: T.accent, color: 'white',
              fontWeight: 600, fontSize: 16, width: '100%',
              border: 'none', cursor: 'pointer', transition: 'background .15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = T.accentHover)}
            onMouseLeave={e => (e.currentTarget.style.background = T.accent)}
          >
            <Plus size={20} color="white" />
            Dodaj transakcję
          </button>
        </div>
      </nav>

      {/* User */}
      <div style={{ padding: '12px 14px', borderTop: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontSize: 14, fontWeight: 700,
        }}>{initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.dark, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayEmail}</div>
          <div style={{ fontSize: 13, color: T.muted }}>Sesja aktywna</div>
        </div>
        <form action={logout}>
          <button title="Wyloguj" style={{ color: T.muted, border: 'none', background: 'none', cursor: 'pointer', padding: 2 }}>
            <LogOut size={17} />
          </button>
        </form>
      </div>
    </div>
  );
}
