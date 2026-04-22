'use client';
import { ChevronRight, Sparkles } from 'lucide-react';
import { T } from '@/lib/tokens';
import { fmtPLN, fmtShort } from '@/lib/utils';
import { Account, Category, Transaction } from '@/lib/data';
import Card from '@/components/ui/Card';
import StatPill from '@/components/ui/StatPill';
import Bar from '@/components/ui/Bar';
import Sparkline from '@/components/ui/Sparkline';
import Donut from '@/components/ui/Donut';
import Icon from '@/components/ui/Icon';
import { ScreenId } from '@/components/App';

interface HomeScreenProps {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  overallBudget: number | null;
  onNav: (id: ScreenId) => void;
  onSelectTx: (tx: Transaction) => void;
}

export default function HomeScreen({ accounts, categories, transactions, overallBudget, onNav, onSelectTx }: HomeScreenProps) {
  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = Math.abs(transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0));
  const donutData = categories.slice(0, 5).map(c => ({ value: c.spent, color: c.color }));
  const budgetAmount = overallBudget ?? 0;

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 }}>
        <Card style={{ padding: 20, gridColumn: 'span 2' }}>
          <div style={{ fontSize: 12, color: T.muted, fontWeight: 500, marginBottom: 4 }}>Łączny majątek</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: T.dark, letterSpacing: '-1px', marginBottom: 12 }}>{fmtPLN(totalBalance)}</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <StatPill label="Przychody" amount={income} type="income" />
            <StatPill label="Wydatki" amount={expense} type="expense" />
          </div>
        </Card>

        {budgetAmount > 0 ? (
          <Card style={{ padding: 20 }}>
            <div style={{ fontSize: 12, color: T.muted, fontWeight: 500, marginBottom: 4 }}>Budżet miesięczny</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: T.dark, marginBottom: 6 }}>
              {fmtShort(expense)} <span style={{ fontSize: 13, color: T.muted, fontWeight: 400 }}>/ {fmtShort(budgetAmount)}</span>
            </div>
            <Bar pct={expense / budgetAmount * 100} color={T.accent} />
            <div style={{ fontSize: 12, color: T.muted, marginTop: 6 }}>{Math.round(expense / budgetAmount * 100)}% wykorzystano</div>
          </Card>
        ) : (
          <Card style={{ padding: 20 }}>
            <div style={{ fontSize: 12, color: T.muted, fontWeight: 500, marginBottom: 4 }}>Budżet miesięczny</div>
            <div style={{ fontSize: 13, color: T.faint, marginTop: 8 }}>Brak budżetu</div>
          </Card>
        )}

        <Card style={{ padding: 20 }}>
          <div style={{ fontSize: 12, color: T.muted, fontWeight: 500, marginBottom: 4 }}>Bilans miesiąca</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: income - expense >= 0 ? T.income : T.expense, marginBottom: 2 }}>
            {fmtPLN(income - expense, true)}
          </div>
          <div style={{ marginTop: 10 }}><Sparkline color={income - expense >= 0 ? T.income : T.expense} /></div>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: T.dark }}>Ostatnie transakcje</div>
            <button
              onClick={() => onNav('transactions')}
              style={{ fontSize: 12, color: T.accent, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4, border: 'none', background: 'none', cursor: 'pointer' }}
            >
              Wszystkie <ChevronRight size={14} color={T.accent} />
            </button>
          </div>
          {transactions.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', fontSize: 13, color: T.faint }}>Brak transakcji w tym miesiącu</div>
          )}
          {transactions.slice(0, 7).map((tx, i) => (
            <div
              key={tx.id}
              onClick={() => onSelectTx(tx)}
              style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: i < Math.min(6, transactions.length - 1) ? `1px solid ${T.border}` : 'none', cursor: 'pointer', transition: 'background .1s' }}
              onMouseEnter={e => (e.currentTarget.style.background = T.bg)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ width: 36, height: 36, borderRadius: 10, background: tx.catBg, color: tx.catColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name={tx.catIcon} size={18} color={tx.catColor} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.dark, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.cat}</div>
                <div style={{ fontSize: 12, color: T.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.desc || tx.loc || tx.acc}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: tx.type === 'expense' ? T.expense : tx.type === 'income' ? T.income : T.mid }}>
                  {tx.type === 'expense' ? '-' : tx.type === 'income' ? '+' : ''}{fmtPLN(Math.abs(tx.amount))}
                </div>
                <div style={{ fontSize: 11, color: T.faint }}>{tx.date.slice(5).replace('-', '.')}</div>
              </div>
            </div>
          ))}
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {donutData.length > 0 && (
            <Card style={{ padding: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: T.dark, marginBottom: 12 }}>Wydatki wg kategorii</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <Donut data={donutData} size={96} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {categories.slice(0, 5).map(c => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: T.muted, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: T.mid, flexShrink: 0 }}>{fmtShort(c.spent)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          <Card style={{ padding: 16, background: 'linear-gradient(135deg,#eef2ff 0%,#f5f3ff 100%)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Sparkles size={16} color={T.accent} />
              <span style={{ fontSize: 13, fontWeight: 600, color: T.accent }}>Analiza AI</span>
            </div>
            <p style={{ fontSize: 12, color: T.mid, lineHeight: 1.6 }}>
              Masz {transactions.length} transakcji w tym miesiącu. Łącznie wydałeś <strong>{fmtPLN(expense)}</strong> i zarobiłeś <strong>{fmtPLN(income)}</strong>.
            </p>
          </Card>
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: T.dark }}>Konta</div>
          <button
            onClick={() => onNav('accounts')}
            style={{ fontSize: 12, color: T.accent, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4, border: 'none', background: 'none', cursor: 'pointer' }}
          >
            Wszystkie <ChevronRight size={14} color={T.accent} />
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          {accounts.map(a => (
            <Card key={a.id} style={{ padding: 18, background: `linear-gradient(135deg,${a.color},${a.color2})`, border: 'none', cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.9)' }}>{a.name}</div>
                <Icon name={a.icon} size={20} color="rgba(255,255,255,.85)" />
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'white', letterSpacing: '-0.5px' }}>{fmtPLN(a.balance)}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.7)', marginTop: 4 }}>{a.type}</div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
