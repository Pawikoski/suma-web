'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardList } from 'lucide-react';
import { T } from '@/lib/tokens';
import { useAppData } from '@/lib/AppDataContext';
import Card from '@/components/ui/Card';
import Sparkline from '@/components/ui/Sparkline';
import Icon from '@/components/ui/Icon';
import PrivacyAmount from '@/components/ui/PrivacyAmount';

export default function AccountsScreen() {
  const router = useRouter();
  const { accounts, transactions } = useAppData();
  const [selected, setSelected] = useState(accounts[0] ?? null);

  const totalBalance = accounts.filter(a => a.includeInNetWorth).reduce((s, a) => s + a.balance, 0);

  const accTxs = selected ? transactions.filter(t => t.acc === selected.name) : [];
  const accIncome = accTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const accExpense = Math.abs(accTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0));

  return (
    <div className="screen accounts-screen" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <div style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>Łączny majątek</div>
        <PrivacyAmount amount={totalBalance} style={{ display: 'block', fontSize: 28, fontWeight: 800, color: T.dark }} />
      </div>

      <div className="account-card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {accounts.map(a => (
          <Card
            key={a.id}
            onClick={() => setSelected(a)}
            style={{
              padding: 18, cursor: 'pointer',
              background: selected?.id === a.id ? `linear-gradient(135deg,${a.color},${a.color2})` : 'white',
              border: selected?.id === a.id ? 'none' : `1px solid ${T.border}`,
              transition: 'all .2s',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: selected?.id === a.id ? 'rgba(255,255,255,.9)' : T.mid }}>{a.name}</div>
              <Icon name={a.icon} size={20} color={selected?.id === a.id ? 'rgba(255,255,255,.85)' : a.color} />
            </div>
            <PrivacyAmount amount={a.balance} style={{ display: 'block', fontSize: 20, fontWeight: 800, color: selected?.id === a.id ? 'white' : T.dark }} />
            <div style={{ fontSize: 11, color: selected?.id === a.id ? 'rgba(255,255,255,.65)' : T.faint, marginTop: 4 }}>{a.type}</div>
          </Card>
        ))}
      </div>

      {selected && (
        <div className="accounts-detail-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.border}`, fontWeight: 600, fontSize: 14, color: T.dark }}>
              Historia — {selected.name}
            </div>
            {accTxs.length === 0 && (
              <div style={{ padding: 40, textAlign: 'center', color: T.faint }}>
                <ClipboardList size={32} color={T.faint} />
                <div style={{ marginTop: 10, fontSize: 13 }}>Brak transakcji</div>
              </div>
            )}
            {accTxs.map((tx, i) => (
              <div
                key={tx.id}
                onClick={() => router.push(`/transactions?id=${tx.id}`)}
                style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: i < accTxs.length - 1 ? `1px solid ${T.border}` : 'none', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = T.bg)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ width: 36, height: 36, borderRadius: 10, background: tx.catBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={tx.catIcon} size={18} color={tx.catColor} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.dark }}>{tx.cat}</div>
                  <div style={{ fontSize: 12, color: T.muted }}>{tx.desc || tx.loc || ''}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: tx.type === 'expense' ? T.expense : tx.type === 'income' ? T.income : T.mid }}>
                    <PrivacyAmount amount={Math.abs(tx.amount)} prefix={tx.type === 'expense' ? '-' : tx.type === 'income' ? '+' : ''} style={{ font: 'inherit' }} />
                  </div>
                  <div style={{ fontSize: 11, color: T.faint }}>{tx.date.slice(5).replace('-', '.')}</div>
                </div>
              </div>
            ))}
          </Card>

          <Card style={{ padding: 20 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: T.dark, marginBottom: 16 }}>Statystyki konta</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ padding: 14, borderRadius: 10, background: T.incomeSoft }}>
                <div style={{ fontSize: 12, color: T.income, fontWeight: 500 }}>Przychody</div>
                <PrivacyAmount amount={accIncome} prefix="+" style={{ display: 'block', fontSize: 20, fontWeight: 700, color: T.income }} />
              </div>
              <div style={{ padding: 14, borderRadius: 10, background: T.expenseSoft }}>
                <div style={{ fontSize: 12, color: T.expense, fontWeight: 500 }}>Wydatki</div>
                <PrivacyAmount amount={accExpense} prefix="-" style={{ display: 'block', fontSize: 20, fontWeight: 700, color: T.expense }} />
              </div>
              <div style={{ padding: 14, borderRadius: 10, background: T.bg }}>
                <div style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>Bilans</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: accIncome - accExpense >= 0 ? T.income : T.expense }}>
                  <PrivacyAmount amount={accIncome - accExpense} signed style={{ font: 'inherit' }} />
                </div>
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <Sparkline color={T.accent} />
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
