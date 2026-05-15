'use client';
import { CSSProperties, memo, useCallback, useMemo, useState, useTransition } from 'react';
import { ColumnDef, SortingState, flexRender, getCoreRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table';
import { parseAsString, parseAsStringLiteral, useQueryState } from 'nuqs';
import { ArrowUpDown, Download, MapPin, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { deleteTransactionAction, deleteTransactionsAction } from '@/app/actions/sync';
import { T } from '@/lib/tokens';
import { Transaction } from '@/lib/data';
import { useActiveMonthData } from '@/lib/useActiveMonthData';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Icon from '@/components/ui/Icon';
import PrivacyAmount from '@/components/ui/PrivacyAmount';

const TX_FILTERS = ['all', 'expense', 'income', 'transfer'] as const;
type TxFilter = typeof TX_FILTERS[number];

function TxDetailPanel({ tx, onClose }: { tx: Transaction; onClose: () => void }) {
  const router = useRouter();
  const [isDeleting, startDeleteTransition] = useTransition();
  const amtColor = tx.type === 'expense' ? T.expense : tx.type === 'income' ? T.income : T.mid;
  const deleteTx = () => {
    startDeleteTransition(async () => {
      const result = await deleteTransactionAction(tx.id);
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
    <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: T.dark }}>Szczegóły</div>
        <button onClick={onClose} style={{ color: T.muted, padding: 4, border: 'none', background: 'none', cursor: 'pointer' }}>
          <X size={18} />
        </button>
      </div>

      <Card style={{ padding: 22, textAlign: 'center' }}>
        <div style={{ width: 60, height: 60, borderRadius: 16, background: tx.catBg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
          <Icon name={tx.catIcon} size={30} color={tx.catColor} />
        </div>
        <Badge type={tx.type} />
        <div style={{ fontSize: 34, fontWeight: 800, color: amtColor, marginTop: 10, letterSpacing: '-1px' }}>
          <PrivacyAmount amount={Math.abs(tx.amount)} prefix={tx.type === 'expense' ? '-' : tx.type === 'income' ? '+' : ''} style={{ font: 'inherit' }} />
        </div>
        <div style={{ fontSize: 15, color: T.muted, marginTop: 4 }}>{tx.cat}</div>
      </Card>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {([
          { label: 'Data', value: tx.date.split('-').reverse().join('.') },
          { label: 'Konto', value: tx.acc },
          tx.toAccountName ? { label: 'Do konta', value: tx.toAccountName } : null,
          tx.desc ? { label: 'Opis', value: tx.desc } : null,
          tx.loc ? { label: 'Miejsce', value: tx.loc } : null,
        ].filter(Boolean) as { label: string; value: string }[]).map((row, i, arr) => (
          <div key={row.label} style={{ padding: '13px 16px', display: 'flex', justifyContent: 'space-between', gap: 12, borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : 'none' }}>
            <span style={{ fontSize: 14, color: T.muted }}>{row.label}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: T.mid, textAlign: 'right' }}>{row.value}</span>
          </div>
        ))}
      </Card>

      {tx.loc && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', borderRadius: T.radiusSm, background: T.bg, fontSize: 14, color: T.muted }}>
          <MapPin size={16} color={T.accent} />
          {tx.loc}
        </div>
      )}

      <button
        onClick={deleteTx}
        disabled={isDeleting}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 14px', borderRadius: T.radiusSm, background: T.expenseSoft, color: T.expense, fontWeight: 700, opacity: isDeleting ? 0.65 : 1 }}
      >
        <Trash2 size={16} color={T.expense} />
        {isDeleting ? 'Usuwanie...' : 'Usuń transakcję'}
      </button>
    </div>
  );
}

interface TransactionsTableProps {
  transactions: Transaction[];
  onSelect: (tx: Transaction) => void;
  selectedIds: Set<string>;
  onToggleSelected: (transactionId: string) => void;
  onToggleVisible: () => void;
}

const TransactionsTable = memo(function TransactionsTable({ transactions, onSelect, selectedIds, onToggleSelected, onToggleVisible }: TransactionsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'date', desc: true }]);
  const visibleIds = useMemo(() => transactions.map(tx => tx.id), [transactions]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.has(id));

  const columns = useMemo<ColumnDef<Transaction>[]>(() => [
    {
      id: 'select',
      header: () => (
        <input
          aria-label={allVisibleSelected ? 'Odznacz widoczne transakcje' : 'Zaznacz widoczne transakcje'}
          type="checkbox"
          checked={allVisibleSelected}
          onChange={onToggleVisible}
          style={{ width: 16, height: 16, accentColor: T.accent }}
        />
      ),
      cell: ({ row }) => {
        const tx = row.original;
        return (
          <input
            aria-label={`Zaznacz transakcję ${tx.cat}`}
            type="checkbox"
            checked={selectedIds.has(tx.id)}
            onClick={event => event.stopPropagation()}
            onChange={() => onToggleSelected(tx.id)}
            style={{ width: 16, height: 16, accentColor: T.accent }}
          />
        );
      },
      enableSorting: false,
    },
    {
      id: 'category',
      accessorKey: 'cat',
      header: 'Kategoria',
      cell: ({ row }) => {
        const tx = row.original;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: tx.catBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name={tx.catIcon} size={22} color={tx.catColor} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.dark }}>{tx.cat}</div>
              <div style={{ fontSize: 14, color: T.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{tx.desc || tx.loc || tx.acc}</div>
            </div>
          </div>
        );
      },
    },
    {
      id: 'account',
      accessorKey: 'acc',
      header: 'Konto',
      cell: ({ getValue }) => <span style={{ fontSize: 15, color: T.mid }}>{getValue<string>()}</span>,
    },
    {
      id: 'date',
      accessorKey: 'date',
      header: 'Data',
      cell: ({ getValue }) => <span style={{ fontSize: 15, color: T.muted }}>{getValue<string>().split('-').reverse().join('.')}</span>,
    },
    {
      id: 'amount',
      accessorKey: 'amount',
      header: 'Kwota',
      cell: ({ row }) => {
        const tx = row.original;
        return (
          <span style={{ fontSize: 16, fontWeight: 800, color: tx.type === 'expense' ? T.expense : tx.type === 'income' ? T.income : T.mid }}>
            <PrivacyAmount amount={Math.abs(tx.amount)} prefix={tx.type === 'expense' ? '-' : tx.type === 'income' ? '+' : ''} style={{ font: 'inherit' }} />
          </span>
        );
      },
    },
  ], [allVisibleSelected, onToggleSelected, onToggleVisible, selectedIds]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: transactions,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;

  if (rows.length === 0) {
    return <div style={{ padding: 36, textAlign: 'center', fontSize: 15, color: T.faint }}>Brak transakcji</div>;
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
      <thead>
        {table.getHeaderGroups().map(headerGroup => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map(header => (
              <th
                key={header.id}
                onClick={header.column.getToggleSortingHandler()}
                style={{
                  padding: '12px 22px',
                  borderBottom: `1px solid ${T.border}`,
                  color: T.muted,
                  cursor: header.column.getCanSort() ? 'pointer' : 'default',
                  fontSize: 13,
                  fontWeight: 700,
                  textAlign: header.column.id === 'amount' ? 'right' : 'left',
                  width: header.column.id === 'select' ? 44 : header.column.id === 'category' ? '42%' : header.column.id === 'amount' ? '18%' : '18%',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {header.column.getCanSort() && <ArrowUpDown size={13} color={T.faint} />}
                </span>
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {rows.map((row, i) => {
          const tx = row.original;
          return (
            <tr
              key={row.id}
              onClick={() => onSelect(tx)}
              style={{
                borderBottom: i < rows.length - 1 ? `1px solid ${T.border}` : 'none',
                cursor: 'pointer',
                transition: 'background .1s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = T.bg; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              {row.getVisibleCells().map(cell => (
                <td
                  key={cell.id}
                  style={{
                    padding: '16px 22px',
                    textAlign: cell.column.id === 'amount' ? 'right' : 'left',
                    width: cell.column.id === 'select' ? 44 : undefined,
                    verticalAlign: 'middle',
                  }}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
});

export default function TransactionsScreen() {
  const router = useRouter();
  const { accounts, categories, allTransactions, activeMonth, setActiveMonthParam, availableMonths } = useActiveMonthData();
  const [filter, setFilter] = useQueryState('type', parseAsStringLiteral(TX_FILTERS).withDefault('all'));
  const [selectedId, setSelectedId] = useQueryState('id');
  const [accountId, setAccountId] = useQueryState('account', parseAsString.withDefault('all'));
  const [categoryId, setCategoryId] = useQueryState('category', parseAsString.withDefault('all'));
  const [query, setQuery] = useQueryState('q', parseAsString.withDefault(''));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, startBulkDeleteTransition] = useTransition();

  const selectedTx = useMemo(
    () => selectedId ? allTransactions.find(t => t.id === selectedId) ?? null : null,
    [allTransactions, selectedId]
  );

  const filtered = useMemo(() => {
    const textQuery = query.trim().toLocaleLowerCase('pl-PL');
    return allTransactions.filter(t => {
      if (activeMonth !== 'all' && !t.date.startsWith(activeMonth)) return false;
      if (filter !== 'all' && t.type !== filter) return false;
      if (accountId !== 'all' && t.accountId !== accountId && t.toAccountId !== accountId) return false;
      if (categoryId !== 'all' && t.categoryId !== categoryId) return false;
      if (!textQuery) return true;
      return [t.cat, t.desc, t.acc, t.toAccountName, t.loc, t.amount.toString()]
        .filter(Boolean)
        .some(value => String(value).toLocaleLowerCase('pl-PL').includes(textQuery));
    });
  }, [accountId, activeMonth, allTransactions, categoryId, filter, query]);
  const income = filtered.filter(t => t.type === 'income').reduce((sum, tx) => sum + tx.amount, 0);
  const expense = Math.abs(filtered.filter(t => t.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0));
  const selectedTransactions = useMemo(
    () => allTransactions.filter(tx => selectedIds.has(tx.id)),
    [allTransactions, selectedIds]
  );
  const selectedIncome = selectedTransactions.filter(t => t.type === 'income').reduce((sum, tx) => sum + tx.amount, 0);
  const selectedExpense = Math.abs(selectedTransactions.filter(t => t.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0));
  const exportFiltered = useCallback(() => {
    const quote = (value: string | number | null | undefined) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const rows = [
      ['date', 'type', 'category', 'account', 'to_account', 'description', 'amount', 'currency'],
      ...filtered.map(tx => [
        tx.date,
        tx.type,
        tx.cat,
        tx.acc,
        tx.toAccountName ?? '',
        tx.desc,
        tx.amount.toFixed(2),
        tx.currency,
      ]),
    ];
    const csv = rows.map(row => row.map(quote).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `suma-transakcje-${activeMonth}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [activeMonth, filtered]);

  const setTypedFilter = useCallback((value: TxFilter) => {
    void setFilter(value);
  }, [setFilter]);
  const selectTx = useCallback((tx: Transaction) => {
    void setSelectedId(tx.id);
  }, [setSelectedId]);
  const deselectTx = useCallback(() => {
    void setSelectedId(null);
  }, [setSelectedId]);
  const toggleSelected = useCallback((transactionId: string) => {
    setSelectedIds(current => {
      const next = new Set(current);
      if (next.has(transactionId)) next.delete(transactionId);
      else next.add(transactionId);
      return next;
    });
  }, []);
  const toggleVisible = useCallback(() => {
    setSelectedIds(current => {
      const next = new Set(current);
      const visibleIds = filtered.map(tx => tx.id);
      const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => next.has(id));
      visibleIds.forEach(id => {
        if (allVisibleSelected) next.delete(id);
        else next.add(id);
      });
      return next;
    });
  }, [filtered]);
  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);
  const deleteSelected = useCallback(() => {
    const ids = Array.from(selectedIds);
    startBulkDeleteTransition(async () => {
      const result = await deleteTransactionsAction(ids);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      clearSelection();
      void setSelectedId(null);
      router.refresh();
    });
  }, [clearSelection, router, selectedIds, setSelectedId]);

  return (
    <div className="transactions-layout" style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: 28 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {TX_FILTERS.map(f => (
              <button
                key={f}
                onClick={() => setTypedFilter(f)}
                style={{
                  padding: '8px 16px', borderRadius: 20, fontSize: 15, fontWeight: 600,
                  background: filter === f ? T.dark : 'transparent',
                  color: filter === f ? 'white' : T.muted,
                  border: `1px solid ${filter === f ? T.dark : T.border}`,
                  transition: 'all .15s', cursor: 'pointer',
                }}
              >
                {f === 'all' ? 'Wszystkie' : f === 'expense' ? 'Wydatki' : f === 'income' ? 'Przychody' : 'Transfery'}
              </button>
            ))}
          </div>

          <Card className="transaction-filter-card" style={{ padding: 12, display: 'grid', gridTemplateColumns: '1.2fr .8fr .9fr .9fr auto auto', gap: 10, alignItems: 'center' }}>
            <input
              value={query}
              onChange={e => void setQuery(e.target.value)}
              placeholder="Szukaj po opisie, kategorii, koncie..."
              style={{ height: 38, border: `1px solid ${T.border}`, borderRadius: T.radiusSm, padding: '0 12px', font: 'inherit', color: T.dark, outline: 'none' }}
            />
            <select value={activeMonth} onChange={e => void setActiveMonthParam(e.target.value)} style={selectStyle}>
              <option value="all">Wszystkie miesiące</option>
              {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select value={accountId} onChange={e => void setAccountId(e.target.value)} style={selectStyle}>
              <option value="all">Wszystkie konta</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <select value={categoryId} onChange={e => void setCategoryId(e.target.value)} style={selectStyle}>
              <option value="all">Wszystkie kategorie</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', fontSize: 13, color: T.muted, whiteSpace: 'nowrap' }}>
              <strong style={{ color: T.income }}>+{income.toLocaleString('pl-PL', { maximumFractionDigits: 0 })} zł</strong>
              <strong style={{ color: T.expense }}>-{expense.toLocaleString('pl-PL', { maximumFractionDigits: 0 })} zł</strong>
            </div>
            <button
              onClick={exportFiltered}
              disabled={filtered.length === 0}
              style={{ height: 38, padding: '0 12px', borderRadius: T.radiusSm, background: T.dark, color: 'white', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, opacity: filtered.length === 0 ? 0.5 : 1 }}
            >
              <Download size={16} color="white" />
              CSV
            </button>
          </Card>
        </div>

        {selectedTransactions.length > 0 && (
          <Card className="selection-summary-bar" style={{ padding: '12px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between', background: T.dark, color: 'white' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
              <strong style={{ fontSize: 15 }}>{selectedTransactions.length} zazn.</strong>
              <span style={{ fontSize: 13, color: '#cbd5e1' }}>
                Przychody: <strong style={{ color: '#86efac' }}><PrivacyAmount amount={selectedIncome} prefix="+" /></strong>
              </span>
              <span style={{ fontSize: 13, color: '#cbd5e1' }}>
                Wydatki: <strong style={{ color: '#fca5a5' }}><PrivacyAmount amount={selectedExpense} prefix="-" /></strong>
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button
                onClick={clearSelection}
                style={{ height: 34, padding: '0 12px', borderRadius: T.radiusSm, background: 'rgba(255,255,255,.1)', color: 'white', fontWeight: 700 }}
              >
                Wyczyść
              </button>
              <button
                onClick={deleteSelected}
                disabled={isBulkDeleting}
                style={{ height: 34, padding: '0 12px', borderRadius: T.radiusSm, background: T.expense, color: 'white', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8, opacity: isBulkDeleting ? 0.65 : 1 }}
              >
                <Trash2 size={15} color="white" />
                {isBulkDeleting ? 'Usuwanie...' : 'Usuń'}
              </button>
            </div>
          </Card>
        )}

        <Card className="transaction-table-card" style={{ padding: 0, overflow: 'hidden' }}>
          <TransactionsTable
            transactions={filtered}
            onSelect={selectTx}
            selectedIds={selectedIds}
            onToggleSelected={toggleSelected}
            onToggleVisible={toggleVisible}
          />
        </Card>
      </div>

      {selectedTx && (
        <div className="transaction-detail-sidebar" style={{ width: 340, borderLeft: `1px solid ${T.border}`, overflowY: 'auto', background: T.card }}>
          <TxDetailPanel tx={selectedTx} onClose={deselectTx} />
        </div>
      )}
    </div>
  );
}

const selectStyle: CSSProperties = {
  height: 38,
  border: `1px solid ${T.border}`,
  borderRadius: T.radiusSm,
  padding: '0 10px',
  font: 'inherit',
  color: T.mid,
  background: T.card,
  outline: 'none',
};
