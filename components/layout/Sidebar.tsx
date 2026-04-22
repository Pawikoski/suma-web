'use client';
import { Home, ClipboardList, Tag, Wallet, BarChart2, Plus, Settings } from 'lucide-react';
import { T } from '@/lib/tokens';
import { ScreenId } from '@/components/App';

const NAV: { id: ScreenId; label: string; Icon: React.ElementType }[] = [
  { id: 'home',         label: 'Home',       Icon: Home },
  { id: 'transactions', label: 'Transakcje', Icon: ClipboardList },
  { id: 'categories',   label: 'Kategorie',  Icon: Tag },
  { id: 'accounts',     label: 'Konta',      Icon: Wallet },
  { id: 'budget',       label: 'Budżet',     Icon: BarChart2 },
];

interface SidebarProps {
  active: ScreenId;
  onNav: (id: ScreenId) => void;
  onAdd: () => void;
}

export default function Sidebar({ active, onNav, onAdd }: SidebarProps) {
  return (
    <div style={{
      width: T.sidebarW, background: T.sidebar,
      borderRight: `1px solid ${T.border}`,
      display: 'flex', flexDirection: 'column',
      height: '100vh', position: 'fixed', left: 0, top: 0, zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{ padding: '24px 20px 16px', borderBottom: `1px solid ${T.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10, background: T.accent,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: 18, fontWeight: 800, letterSpacing: -1,
          }}>Σ</div>
          <span style={{ fontSize: 18, fontWeight: 800, color: T.dark, letterSpacing: '-0.5px' }}>Suma</span>
        </div>
        <div style={{ fontSize: 11, color: T.muted, marginTop: 6, marginLeft: 44 }}>Kwiecień 2026</div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV.map(({ id, label, Icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              onClick={() => onNav(id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '9px 12px', borderRadius: T.radiusSm,
                background: isActive ? T.accentLight : 'transparent',
                color: isActive ? T.accent : T.mid,
                fontWeight: isActive ? 600 : 400, fontSize: 14,
                transition: 'all .15s', textAlign: 'left', width: '100%', border: 'none', cursor: 'pointer',
              }}
            >
              <Icon size={18} color={isActive ? T.accent : T.muted} />
              {label}
            </button>
          );
        })}

        <div style={{ marginTop: 12, borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
          <button
            onClick={onAdd}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '9px 12px', borderRadius: T.radiusSm,
              background: T.accent, color: 'white',
              fontWeight: 600, fontSize: 14, width: '100%',
              border: 'none', cursor: 'pointer', transition: 'background .15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = T.accentHover)}
            onMouseLeave={e => (e.currentTarget.style.background = T.accent)}
          >
            <Plus size={18} color="white" />
            Dodaj transakcję
          </button>
        </div>
      </nav>

      {/* User */}
      <div style={{ padding: '12px 14px', borderTop: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontSize: 13, fontWeight: 700,
        }}>PK</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.dark, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Paweł K.</div>
          <div style={{ fontSize: 11, color: T.muted }}>Premium</div>
        </div>
        <button style={{ color: T.muted, border: 'none', background: 'none', cursor: 'pointer', padding: 2 }}>
          <Settings size={15} />
        </button>
      </div>
    </div>
  );
}
