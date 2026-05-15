'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, Sparkles } from 'lucide-react';
import { T } from '@/lib/tokens';
import { fmtShort } from '@/lib/utils';
import { useActiveMonthData } from '@/lib/useActiveMonthData';
import Card from '@/components/ui/Card';
import StatPill from '@/components/ui/StatPill';
import Bar from '@/components/ui/Bar';
import Sparkline from '@/components/ui/Sparkline';
import Donut from '@/components/ui/Donut';
import Icon from '@/components/ui/Icon';
import PrivacyAmount from '@/components/ui/PrivacyAmount';

export default function HomeScreen() {
  const router = useRouter();
  const { accounts, categories, transactions, overallBudget, activeMonth } = useActiveMonthData();

  const totalBalance = accounts.filter(a => a.includeInNetWorth).reduce((s, a) => s + a.balance, 0);
  const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = Math.abs(transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0));
  const donutData = categories.slice(0, 5).map(c => ({ value: c.spent, color: c.color }));
  const budgetAmount = overallBudget ?? 0;

  return (
    <div className="screen home-screen" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="home-summary-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 }}>
        <Card style={{ padding: 24, gridColumn: 'span 2' }}>
          <div style={{ fontSize: 14, color: T.muted, fontWeight: 500, marginBottom: 4 }}>Łączny majątek</div>
          <PrivacyAmount amount={totalBalance} style={{ display: 'block', fontSize: 38, fontWeight: 800, color: T.dark, marginBottom: 14 }} />
          <div style={{ display: 'flex', gap: 10 }}>
            <StatPill label="Przychody" amount={income} type="income" />
            <StatPill label="Wydatki" amount={expense} type="expense" />
          </div>
        </Card>

        {budgetAmount > 0 ? (
          <Card style={{ padding: 24 }}>
            <div style={{ fontSize: 14, color: T.muted, fontWeight: 500, marginBottom: 6 }}>Budżet miesięczny</div>
            <div style={{ fontSize: 27, fontWeight: 700, color: T.dark, marginBottom: 8 }}>
              <PrivacyAmount amount={expense} style={{ font: 'inherit' }} /> <span style={{ fontSize: 16, color: T.muted, fontWeight: 400 }}>/ {fmtShort(budgetAmount)}</span>
            </div>
            <Bar pct={expense / budgetAmount * 100} color={T.accent} />
            <div style={{ fontSize: 14, color: T.muted, marginTop: 8 }}>{Math.round(expense / budgetAmount * 100)}% wykorzystano</div>
          </Card>
        ) : (
          <Card style={{ padding: 24 }}>
            <div style={{ fontSize: 14, color: T.muted, fontWeight: 500, marginBottom: 4 }}>Budżet miesięczny</div>
            <div style={{ fontSize: 15, color: T.faint, marginTop: 8 }}>Brak budżetu</div>
          </Card>
        )}

        <Card style={{ padding: 24 }}>
          <div style={{ fontSize: 14, color: T.muted, fontWeight: 500, marginBottom: 6 }}>Bilans miesiąca</div>
          <div style={{ fontSize: 27, fontWeight: 700, color: income - expense >= 0 ? T.income : T.expense, marginBottom: 2 }}>
            <PrivacyAmount amount={income - expense} signed style={{ font: 'inherit' }} />
          </div>
          <div style={{ marginTop: 10 }}><Sparkline color={income - expense >= 0 ? T.income : T.expense} /></div>
        </Card>
      </div>

      <div className="home-content-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '18px 22px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontWeight: 700, fontSize: 18, color: T.dark }}>Ostatnie transakcje</div>
            <Link
              href={`/transactions?month=${activeMonth}`}
              style={{ fontSize: 14, color: T.accent, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
            >
              Wszystkie <ChevronRight size={16} color={T.accent} />
            </Link>
          </div>
          {transactions.length === 0 && (
            <div style={{ padding: 36, textAlign: 'center', fontSize: 15, color: T.faint }}>Brak transakcji w tym miesiącu</div>
          )}
          {transactions.slice(0, 7).map((tx, i) => (
            <div
              key={tx.id}
              onClick={() => router.push(`/transactions?id=${tx.id}&month=${activeMonth}`)}
              style={{ padding: '16px 22px', display: 'flex', alignItems: 'center', gap: 14, borderBottom: i < Math.min(6, transactions.length - 1) ? `1px solid ${T.border}` : 'none', cursor: 'pointer', transition: 'background .1s' }}
              onMouseEnter={e => (e.currentTarget.style.background = T.bg)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ width: 44, height: 44, borderRadius: 12, background: tx.catBg, color: tx.catColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name={tx.catIcon} size={22} color={tx.catColor} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: T.dark, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.cat}</div>
                <div style={{ fontSize: 14, color: T.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{tx.desc || tx.loc || tx.acc}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: tx.type === 'expense' ? T.expense : tx.type === 'income' ? T.income : T.mid }}>
                  <PrivacyAmount amount={Math.abs(tx.amount)} prefix={tx.type === 'expense' ? '-' : tx.type === 'income' ? '+' : ''} style={{ font: 'inherit' }} />
                </div>
                <div style={{ fontSize: 13, color: T.faint, marginTop: 2 }}>{tx.date.slice(5).replace('-', '.')}</div>
              </div>
            </div>
          ))}
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {donutData.length > 0 && (
            <Card style={{ padding: 22 }}>
              <div style={{ fontWeight: 700, fontSize: 17, color: T.dark, marginBottom: 14 }}>Wydatki wg kategorii</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <Donut data={donutData} size={96} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {categories.slice(0, 5).map(c => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: T.muted, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                      <PrivacyAmount amount={c.spent} style={{ fontSize: 13, fontWeight: 700, color: T.mid, flexShrink: 0 }} />
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          <Card style={{ padding: 16, background: 'linear-gradient(135deg,#eef2ff 0%,#f5f3ff 100%)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Sparkles size={16} color={T.accent} />
              <span style={{ fontSize: 15, fontWeight: 700, color: T.accent }}>Analiza AI</span>
            </div>
            <p style={{ fontSize: 14, color: T.mid, lineHeight: 1.6 }}>
              Masz {transactions.length} transakcji w tym miesiącu. Łącznie wydałeś <strong><PrivacyAmount amount={expense} /></strong> i zarobiłeś <strong><PrivacyAmount amount={income} /></strong>.
            </p>
          </Card>
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 18, color: T.dark }}>Konta</div>
          <Link
            href={`/accounts?month=${activeMonth}`}
            style={{ fontSize: 14, color: T.accent, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
          >
            Wszystkie <ChevronRight size={16} color={T.accent} />
          </Link>
        </div>
        <div className="account-card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          {accounts.map(a => (
            <Card key={a.id} style={{ padding: 20, background: `linear-gradient(135deg,${a.color},${a.color2})`, border: 'none', cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,.9)' }}>{a.name}</div>
                <Icon name={a.icon} size={22} color="rgba(255,255,255,.85)" />
              </div>
              <PrivacyAmount amount={a.balance} style={{ display: 'block', fontSize: 24, fontWeight: 800, color: 'white' }} />
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,.75)', marginTop: 4 }}>{a.type}</div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
