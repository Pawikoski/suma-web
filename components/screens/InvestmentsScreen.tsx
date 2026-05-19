'use client';

import { useMemo, useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowDownCircle, ArrowUpCircle, BriefcaseBusiness, Coins, LineChart, Pencil, Plus, Save, ShoppingCart, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  createInvestmentHoldingAction,
  deleteInvestmentHoldingAction,
  tradeInvestmentHoldingAction,
  updateInvestmentHoldingAction,
} from '@/app/actions/sync';
import { T } from '@/lib/tokens';
import { Account, InvestmentHolding, InvestmentType } from '@/lib/data';
import { useActiveMonthData } from '@/lib/useActiveMonthData';
import Card from '@/components/ui/Card';
import PrivacyAmount from '@/components/ui/PrivacyAmount';

const TYPE_META: Record<InvestmentType, { label: string; color: string; bg: string }> = {
  STOCK: { label: 'Akcje', color: '#3B82F6', bg: '#DBEAFE' },
  ETF: { label: 'ETF', color: '#10B981', bg: '#D1FAE5' },
  CRYPTO: { label: 'Krypto', color: '#F59E0B', bg: '#FEF3C7' },
  PRECIOUS_METAL: { label: 'Metale', color: '#D97706', bg: '#FEF3C7' },
};

function formatQuantity(value: number) {
  return value.toLocaleString('pl-PL', { maximumFractionDigits: 8 });
}

export default function InvestmentsScreen({ initialAccountId = 'all' }: { initialAccountId?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const { investmentHoldings, accounts, activeMonth } = useActiveMonthData();
  const [accountId, setAccountId] = useState(initialAccountId);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingHolding, setEditingHolding] = useState<InvestmentHolding | null>(null);
  const [tradeHolding, setTradeHolding] = useState<{ holding: InvestmentHolding; type: 'BUY' | 'SELL' } | null>(null);
  const investmentAccounts = accounts.filter(account => account.rawType === 'INVESTMENT' && account.category !== 'LIABILITY' && !account.deletedAt);
  const investmentAccountIds = new Set(investmentAccounts.map(account => account.id));
  const filtered = accountId === 'all'
    ? investmentHoldings.filter(holding => holding.accountId && investmentAccountIds.has(holding.accountId))
    : investmentHoldings.filter(holding => holding.accountId === accountId && investmentAccountIds.has(holding.accountId));
  const selectedAccounts = accountId === 'all'
    ? investmentAccounts
    : investmentAccounts.filter(account => account.id === accountId);
  const investmentValue = filtered.reduce((sum, holding) => sum + holding.value, 0);
  const freeCash = selectedAccounts.reduce((sum, account) => sum + account.balance, 0);
  const totalValue = investmentValue + freeCash;
  const transactionCount = filtered.reduce((sum, holding) => sum + holding.transactions.length, 0);
  const accountById = useMemo(() => new Map(investmentAccounts.map(account => [account.id, account])), [investmentAccounts]);
  const byType = useMemo(() => {
    const result = new Map<InvestmentType, number>();
    for (const holding of filtered) result.set(holding.investmentType, (result.get(holding.investmentType) ?? 0) + holding.value);
    return Array.from(result.entries()).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  if (investmentAccounts.length === 0) {
    return (
      <div className="screen investments-screen" style={{ minHeight: '100%', padding: 24, display: 'grid', placeItems: 'center' }}>
        <div style={{ maxWidth: 430, textAlign: 'center' }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, margin: '0 auto 18px', background: T.accentLight, display: 'grid', placeItems: 'center' }}>
            <LineChart size={34} color={T.accent} />
          </div>
          <h1 style={{ fontSize: 24, color: T.dark, marginBottom: 8 }}>Brak kont inwestycyjnych</h1>
          <p style={{ fontSize: 14, color: T.muted, lineHeight: 1.5 }}>Dodaj konto typu Inwestycje w sekcji Konta, a potem wróć tutaj, żeby prowadzić pozycje, wolne środki i historię operacji.</p>
          <button onClick={() => router.push(`/accounts?month=${activeMonth}`)} style={{ ...primaryButtonStyle, margin: '18px auto 0' }}>
            <BriefcaseBusiness size={16} color="white" /> Przejdź do kont
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen investments-screen" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
        <div>
          <div style={{ color: T.muted, fontSize: 12, fontWeight: 750 }}>Portfel inwestycyjny</div>
          <div style={{ color: T.dark, fontSize: 24, fontWeight: 850 }}>Pozycje i operacje</div>
        </div>
        {investmentAccounts.length > 0 && (
          <button aria-label="Dodaj pozycję" onClick={() => setIsCreateOpen(true)} style={primaryButtonStyle}>
            <Plus size={16} color="white" /> Dodaj pozycję
          </button>
        )}
      </div>

      <div className="investments-summary-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr .8fr', gap: 14 }}>
        <Card style={{ padding: 24, background: T.card }}>
          <div style={{ color: T.muted, fontSize: 12, fontWeight: 850, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Wartość łączna</div>
          <PrivacyAmount amount={totalValue} style={{ display: 'block', color: T.dark, fontSize: 34, fontWeight: 850 }} />
          <div style={{ color: T.muted, fontSize: 13, marginTop: 10 }}>{filtered.length} pozycji plus wolne środki</div>
        </Card>
        <AmountMetricCard icon={<LineChart size={20} color={T.accent} />} label="Pozycje inwestycyjne" value={investmentValue} />
        <AmountMetricCard icon={<Coins size={20} color={T.warn} />} label="Wolne środki" value={freeCash} />
        <MetricCard icon={<BriefcaseBusiness size={20} color={T.accent} />} label="Operacje" value={transactionCount} />
      </div>

      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
        <button
          onClick={() => {
            if (pathname.startsWith('/investments/')) router.push(`/investments?month=${activeMonth}`);
            setAccountId('all');
          }}
          style={chipStyle(accountId === 'all')}
        >
          Wszystkie
        </button>
        {investmentAccounts.map(account => (
          <button
            key={account.id}
            onClick={() => {
              if (pathname.startsWith('/investments/')) router.push(`/investments/${account.id}?month=${activeMonth}`);
              setAccountId(account.id);
            }}
            style={chipStyle(accountId === account.id)}
          >
            {account.name}
          </button>
        ))}
      </div>

      <div className="investments-layout-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {filtered.length === 0 ? (
            <EmptyHoldingsCard onCreate={() => setIsCreateOpen(true)} />
          ) : (
            filtered.map(holding => (
              <HoldingCard
                key={holding.id}
                holding={holding}
                onBuy={() => setTradeHolding({ holding, type: 'BUY' })}
                onSell={() => setTradeHolding({ holding, type: 'SELL' })}
                onEdit={() => setEditingHolding(holding)}
              />
            ))
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card style={{ padding: 18 }}>
            <div style={{ color: T.dark, fontSize: 15, fontWeight: 850, marginBottom: 14 }}>Struktura portfela</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {byType.length === 0 && (
                <div style={{ color: T.muted, fontSize: 13, lineHeight: 1.45 }}>Brak pozycji w wybranym koncie. Wolne środki są pokazane w podsumowaniu.</div>
              )}
              {byType.map(([type, value]) => {
                const meta = TYPE_META[type];
                const pct = investmentValue > 0 ? value / investmentValue * 100 : 0;
                return (
                  <div key={type}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 5 }}>
                      <span style={{ color: T.mid, fontSize: 13, fontWeight: 750 }}>{meta.label}</span>
                      <span style={{ color: T.dark, fontSize: 13, fontWeight: 850 }}>{Math.round(pct)}%</span>
                    </div>
                    <div style={{ height: 7, borderRadius: 999, background: T.bg, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: meta.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card style={{ padding: 18 }}>
            <div style={{ color: T.dark, fontSize: 15, fontWeight: 850, marginBottom: 14 }}>Ostatnie operacje</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {transactionCount === 0 && (
                <div style={{ color: T.muted, fontSize: 13, lineHeight: 1.45 }}>Kupno, sprzedaż i koszt otwarcia pojawią się tutaj po pierwszym zapisie operacji.</div>
              )}
              {filtered
                .flatMap(holding => holding.transactions.map(tx => ({ tx, holding })))
                .sort((a, b) => b.tx.date.localeCompare(a.tx.date))
                .slice(0, 8)
                .map(({ tx, holding }) => (
                  <div key={tx.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 10, alignItems: 'center' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: tx.type === 'BUY' ? T.incomeSoft : T.expenseSoft, display: 'grid', placeItems: 'center' }}>
                      {tx.type === 'BUY' ? <ArrowDownCircle size={17} color={T.income} /> : <ArrowUpCircle size={17} color={T.expense} />}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: T.dark, fontSize: 13, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{holding.symbol}</div>
                      <div style={{ color: T.muted, fontSize: 11 }}>{tx.date}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: tx.type === 'BUY' ? T.income : T.expense, fontSize: 12, fontWeight: 850 }}>{tx.type === 'BUY' ? 'Kupno' : 'Sprzedaż'}</div>
                      <div style={{ color: T.faint, fontSize: 11 }}>{formatQuantity(tx.quantity)}</div>
                    </div>
                  </div>
                ))}
            </div>
          </Card>
        </div>
      </div>
      {isCreateOpen && <HoldingFormModal accounts={investmentAccounts} onClose={() => setIsCreateOpen(false)} />}
      {editingHolding && <HoldingFormModal accounts={investmentAccounts} holding={editingHolding} onClose={() => setEditingHolding(null)} />}
      {tradeHolding && <TradeModal holding={tradeHolding.holding} account={tradeHolding.holding.accountId ? accountById.get(tradeHolding.holding.accountId) ?? null : null} type={tradeHolding.type} onClose={() => setTradeHolding(null)} />}
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card style={{ padding: 18, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 126 }}>
      <div style={{ width: 38, height: 38, borderRadius: 12, background: T.bg, display: 'grid', placeItems: 'center' }}>{icon}</div>
      <div>
        <div style={{ color: T.dark, fontSize: 26, fontWeight: 850 }}>{value}</div>
        <div style={{ color: T.muted, fontSize: 12, fontWeight: 750 }}>{label}</div>
      </div>
    </Card>
  );
}

function AmountMetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card style={{ padding: 18, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 126 }}>
      <div style={{ width: 38, height: 38, borderRadius: 12, background: T.bg, display: 'grid', placeItems: 'center' }}>{icon}</div>
      <div>
        <PrivacyAmount amount={value} style={{ display: 'block', color: T.dark, fontSize: 22, fontWeight: 850 }} />
        <div style={{ color: T.muted, fontSize: 12, fontWeight: 750 }}>{label}</div>
      </div>
    </Card>
  );
}

function EmptyHoldingsCard({ onCreate }: { onCreate: () => void }) {
  return (
    <Card style={{ padding: 24, minHeight: 260, display: 'grid', placeItems: 'center', gridColumn: '1 / -1' }}>
      <div style={{ maxWidth: 430, textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, margin: '0 auto 14px', background: T.accentLight, display: 'grid', placeItems: 'center' }}>
          <LineChart size={26} color={T.accent} />
        </div>
        <div style={{ color: T.dark, fontSize: 18, fontWeight: 850, marginBottom: 6 }}>Brak pozycji w portfelu</div>
        <div style={{ color: T.muted, fontSize: 13, lineHeight: 1.5, marginBottom: 16 }}>Dodaj pierwszą pozycję z kosztem otwarcia. Web zapisze historię inwestycji bez zmiany wolnych środków konta.</div>
        <button onClick={onCreate} style={{ ...primaryButtonStyle, margin: '0 auto' }}>
          <Plus size={16} color="white" /> Dodaj pozycję
        </button>
      </div>
    </Card>
  );
}

function HoldingCard({
  holding,
  onBuy,
  onSell,
  onEdit,
}: {
  holding: InvestmentHolding;
  onBuy: () => void;
  onSell: () => void;
  onEdit: () => void;
}) {
  const meta = TYPE_META[holding.investmentType];
  return (
    <Card style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: meta.bg, color: meta.color, display: 'grid', placeItems: 'center', fontWeight: 900 }}>
          {holding.symbol.slice(0, 2).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: T.dark, fontSize: 15, fontWeight: 850, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{holding.symbol}</div>
          <div style={{ color: T.muted, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{holding.name}</div>
          <div style={{ color: T.faint, fontSize: 12, marginTop: 5 }}>{holding.accountName ?? 'Bez konta'} · {meta.label}</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <PrivacyAmount amount={holding.value} style={{ display: 'block', color: T.dark, fontSize: 16, fontWeight: 850 }} />
          <div style={{ color: T.faint, fontSize: 11 }}>{holding.currency}</div>
        </div>
      </div>
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.border}`, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <div style={{ color: T.faint, fontSize: 11, fontWeight: 750 }}>Ilość</div>
          <div style={{ color: T.mid, fontSize: 13, fontWeight: 850 }}>{formatQuantity(holding.quantity)}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: T.faint, fontSize: 11, fontWeight: 750 }}>Cena</div>
          <PrivacyAmount amount={holding.unitPrice} style={{ color: T.mid, fontSize: 13, fontWeight: 850 }} />
        </div>
      </div>
      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8 }}>
        <button onClick={onBuy} style={{ ...secondaryButtonStyle, color: T.income, background: T.incomeSoft }}>
          <ShoppingCart size={14} /> Kup
        </button>
        <button onClick={onSell} style={{ ...secondaryButtonStyle, color: T.expense, background: T.expenseSoft }}>
          <ArrowUpCircle size={14} /> Sprzedaj
        </button>
        <button aria-label={`Edytuj ${holding.symbol}`} onClick={onEdit} style={iconButtonStyle}>
          <Pencil size={15} />
        </button>
      </div>
    </Card>
  );
}

function chipStyle(active: boolean): React.CSSProperties {
  return {
    height: 34,
    padding: '0 12px',
    borderRadius: 999,
    border: `1px solid ${active ? T.accent : T.border}`,
    background: active ? T.accent : T.card,
    color: active ? 'white' : T.mid,
    fontSize: 13,
    fontWeight: 800,
    whiteSpace: 'nowrap',
  };
}

function HoldingFormModal({
  accounts,
  holding,
  onClose,
}: {
  accounts: Account[];
  holding?: InvestmentHolding;
  onClose: () => void;
}) {
  const router = useRouter();
  const [accountId, setAccountId] = useState<string>(holding?.accountId ?? accounts[0]?.id ?? '');
  const [symbol, setSymbol] = useState(holding?.symbol ?? '');
  const [name, setName] = useState(holding?.name ?? '');
  const [investmentType, setInvestmentType] = useState<InvestmentType>(holding?.investmentType ?? 'STOCK');
  const [quantity, setQuantity] = useState(holding ? String(holding.quantity) : '');
  const [unitPrice, setUnitPrice] = useState(holding ? String(holding.unitPrice.toFixed(2)) : '');
  const [currency, setCurrency] = useState(holding?.currency ?? accounts.find(account => account.id === accountId)?.currency ?? 'PLN');
  const [notes, setNotes] = useState(holding?.notes ?? '');
  const [isPending, startTransition] = useTransition();
  const quantityValue = Number(quantity);
  const unitPriceValue = Number(unitPrice);
  const openingValue = Number.isFinite(quantityValue) && Number.isFinite(unitPriceValue) ? quantityValue * unitPriceValue : 0;
  const canSubmit = Boolean(accountId && symbol.trim() && name.trim() && Number.isFinite(quantityValue) && quantityValue > 0 && Number.isFinite(unitPriceValue) && unitPriceValue > 0);

  const submit = () => {
    startTransition(async () => {
      const payload = {
        id: holding?.id,
        accountId,
        symbol,
        name,
        investmentType,
        quantity: quantityValue,
        unitPrice: unitPriceValue,
        currency,
        notes,
      };
      const result = holding
        ? await updateInvestmentHoldingAction(payload)
        : await createInvestmentHoldingAction(payload);

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      onClose();
      router.refresh();
    });
  };

  const remove = () => {
    if (!holding || !window.confirm('Usunąć pozycję razem z historią operacji?')) return;

    startTransition(async () => {
      const result = await deleteInvestmentHoldingAction(holding.id);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      onClose();
      router.refresh();
    });
  };

  return (
    <ModalShell title={holding ? 'Edycja pozycji' : 'Nowa pozycja'} onClose={onClose}>
      <div style={{ display: 'grid', gap: 12 }}>
        <select aria-label="Konto inwestycyjne" value={accountId} onChange={event => {
          const nextAccountId = event.target.value;
          setAccountId(nextAccountId);
          setCurrency(accounts.find(account => account.id === nextAccountId)?.currency ?? currency);
        }} style={inputStyle}>
          {accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
        </select>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 10 }}>
          <input aria-label="Symbol" placeholder="Symbol" value={symbol} onChange={event => setSymbol(event.target.value.toUpperCase())} style={inputStyle} />
          <input aria-label="Nazwa inwestycji" placeholder="Nazwa" value={name} onChange={event => setName(event.target.value)} style={inputStyle} />
        </div>
        <select aria-label="Typ inwestycji" value={investmentType} onChange={event => setInvestmentType(event.target.value as InvestmentType)} style={inputStyle}>
          {Object.entries(TYPE_META).map(([type, meta]) => <option key={type} value={type}>{meta.label}</option>)}
        </select>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 92px', gap: 10 }}>
          <input aria-label="Ilość" type="number" min="0" step="0.00000001" placeholder="Ilość" value={quantity} onChange={event => setQuantity(event.target.value)} style={inputStyle} />
          <input aria-label="Cena jednostki" type="number" min="0" step="0.01" placeholder="Cena" value={unitPrice} onChange={event => setUnitPrice(event.target.value)} style={inputStyle} />
          <input aria-label="Waluta" value={currency} onChange={event => setCurrency(event.target.value.toUpperCase())} style={inputStyle} />
        </div>
        <div style={{ padding: 12, borderRadius: 12, background: T.bg, color: T.mid, fontSize: 12, lineHeight: 1.45 }}>
          {holding ? 'Edycja zmienia aktualny stan pozycji bez dopisywania nowej operacji.' : 'Koszt otwarcia zapisze pozycję i historię początkową, ale nie zmieni wolnych środków konta.'}
          {!holding && openingValue > 0 && (
            <span> Wartość początkowa: <PrivacyAmount amount={openingValue} style={{ fontWeight: 850 }} />.</span>
          )}
        </div>
        <input aria-label="Notatka inwestycji" placeholder="Notatka" value={notes} onChange={event => setNotes(event.target.value)} style={inputStyle} />
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={submit} disabled={!canSubmit || isPending} style={{ ...primaryButtonStyle, flex: 1, height: 42, opacity: !canSubmit || isPending ? 0.55 : 1 }}>
            <Save size={16} color="white" /> {isPending ? 'Zapisywanie...' : 'Zapisz pozycję'}
          </button>
          {holding && (
            <button aria-label="Usuń pozycję" onClick={remove} disabled={isPending} style={{ ...iconButtonStyle, width: 42, height: 42, color: T.expense, background: T.expenseSoft, opacity: isPending ? 0.55 : 1 }}>
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

function TradeModal({ holding, account, type, onClose }: { holding: InvestmentHolding; account: Account | null; type: 'BUY' | 'SELL'; onClose: () => void }) {
  const router = useRouter();
  const [quantity, setQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState(String(holding.unitPrice.toFixed(2)));
  const [notes, setNotes] = useState('');
  const [isPending, startTransition] = useTransition();
  const quantityValue = Number(quantity);
  const unitPriceValue = Number(unitPrice);
  const operationValue = Number.isFinite(quantityValue) && Number.isFinite(unitPriceValue) ? quantityValue * unitPriceValue : 0;
  const freeCash = account?.balance ?? 0;
  const isTooMuch = type === 'SELL' && quantityValue > holding.quantity;
  const isInsufficientCash = type === 'BUY' && operationValue > freeCash + 0.000001;
  const canSubmit = Number.isFinite(quantityValue) && quantityValue > 0 && Number.isFinite(unitPriceValue) && unitPriceValue > 0 && !isTooMuch && !isInsufficientCash && Boolean(account);
  const title = type === 'BUY' ? `Kup ${holding.symbol}` : `Sprzedaj ${holding.symbol}`;

  const submit = () => {
    startTransition(async () => {
      const result = await tradeInvestmentHoldingAction({
        holdingId: holding.id,
        type,
        quantity: quantityValue,
        unitPrice: unitPriceValue,
        notes,
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      onClose();
      router.refresh();
    });
  };

  return (
    <ModalShell title={title} onClose={onClose}>
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ padding: 12, borderRadius: 12, background: T.bg, color: T.mid, fontSize: 13 }}>
          <div>Posiadasz <strong>{formatQuantity(holding.quantity)}</strong> po średniej cenie <PrivacyAmount amount={holding.unitPrice} style={{ fontWeight: 850 }} /> {holding.currency}.</div>
          <div style={{ marginTop: 6 }}>Wolne środki: <PrivacyAmount amount={freeCash} style={{ fontWeight: 850 }} />. Wartość operacji: <PrivacyAmount amount={operationValue} style={{ fontWeight: 850 }} />.</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <input aria-label="Ilość operacji" type="number" min="0" step="0.00000001" placeholder="Ilość" value={quantity} onChange={event => setQuantity(event.target.value)} style={inputStyle} />
          <input aria-label="Cena operacji" type="number" min="0" step="0.01" placeholder="Cena" value={unitPrice} onChange={event => setUnitPrice(event.target.value)} style={inputStyle} />
        </div>
        {!account && <div style={{ color: T.expense, fontSize: 12, fontWeight: 750 }}>Nie znaleziono aktywnego konta inwestycyjnego dla tej pozycji.</div>}
        {isInsufficientCash && <div style={{ color: T.expense, fontSize: 12, fontWeight: 750 }}>Brak wystarczających wolnych środków na tym koncie.</div>}
        {isTooMuch && <div style={{ color: T.expense, fontSize: 12, fontWeight: 750 }}>Nie możesz sprzedać więcej jednostek niż posiadasz.</div>}
        <input aria-label="Notatka operacji" placeholder="Notatka" value={notes} onChange={event => setNotes(event.target.value)} style={inputStyle} />
        <button onClick={submit} disabled={!canSubmit || isPending} style={{ ...primaryButtonStyle, height: 42, background: type === 'BUY' ? T.income : T.expense, opacity: !canSubmit || isPending ? 0.55 : 1 }}>
          {type === 'BUY' ? <ShoppingCart size={16} color="white" /> : <ArrowUpCircle size={16} color="white" />}
          {isPending ? 'Zapisywanie...' : type === 'BUY' ? 'Zapisz kupno' : 'Zapisz sprzedaż'}
        </button>
      </div>
    </ModalShell>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div role="dialog" aria-modal="true" aria-label={title} style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 210, backdropFilter: 'blur(4px)', padding: 16,
    }}>
      <Card style={{ width: 500, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 0, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ padding: '18px 20px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 850, fontSize: 16, color: T.dark }}>{title}</div>
          <button aria-label="Zamknij" onClick={onClose} style={{ color: T.muted, padding: 4, border: 'none', background: 'none', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </Card>
    </div>
  );
}

const primaryButtonStyle: React.CSSProperties = {
  height: 38,
  padding: '0 14px',
  borderRadius: 12,
  border: 'none',
  background: T.accent,
  color: 'white',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  fontSize: 13,
  fontWeight: 850,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const secondaryButtonStyle: React.CSSProperties = {
  height: 34,
  borderRadius: 10,
  border: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  fontSize: 12,
  fontWeight: 850,
  cursor: 'pointer',
};

const iconButtonStyle: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 10,
  border: `1px solid ${T.border}`,
  background: T.card,
  color: T.mid,
  display: 'grid',
  placeItems: 'center',
  cursor: 'pointer',
};

const inputStyle: React.CSSProperties = {
  height: 40,
  borderRadius: 10,
  border: `1px solid ${T.border}`,
  background: T.card,
  color: T.dark,
  padding: '0 12px',
  fontSize: 13,
  fontWeight: 750,
  minWidth: 0,
};
