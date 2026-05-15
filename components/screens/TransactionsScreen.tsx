'use client';
import { CSSProperties, memo, useCallback, useMemo, useState, useTransition } from 'react';
import { ColumnDef, SortingState, flexRender, getCoreRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table';
import { parseAsString, parseAsStringLiteral, useQueryState } from 'nuqs';
import { ArrowUpDown, Camera, Download, Image as ImageIcon, MapPin, Pencil, RotateCcw, Save, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { deleteTransactionAction, deleteTransactionsAction, updateTransactionAction } from '@/app/actions/sync';
import { T } from '@/lib/tokens';
import { Account, Category, Transaction } from '@/lib/data';
import { useActiveMonthData } from '@/lib/useActiveMonthData';
import { categoryAndDescendantIds } from '@/lib/category-hierarchy';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Icon from '@/components/ui/Icon';
import PrivacyAmount from '@/components/ui/PrivacyAmount';

const TX_FILTERS = ['all', 'expense', 'income', 'transfer'] as const;
type TxFilter = typeof TX_FILTERS[number];

function TxDetailPanel({
  tx,
  accounts,
  categories,
  activeMonth,
  onClose,
}: {
  tx: Transaction;
  accounts: Account[];
  categories: Category[];
  activeMonth: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [type, setType] = useState<TxFilter>(tx.type);
  const [amount, setAmount] = useState(String(tx.rawAmount || Math.abs(tx.amount)));
  const [date, setDate] = useState(tx.date);
  const [accountId, setAccountId] = useState(tx.accountId);
  const [toAccountId, setToAccountId] = useState(tx.toAccountId ?? '');
  const [categoryId, setCategoryId] = useState(tx.categoryId ?? '');
  const [note, setNote] = useState(tx.desc);
  const [isDeleting, startDeleteTransition] = useTransition();
  const [isSaving, startSaveTransition] = useTransition();
  const amtColor = tx.type === 'expense' ? T.expense : tx.type === 'income' ? T.income : T.mid;
  const eligibleCategories = useMemo(() => {
    if (type === 'transfer' || type === 'all') return [];
    const targetType = type === 'income' ? 'INCOME' : 'EXPENSE';
    return categories.filter(c => c.types.length === 0 || c.types.includes(targetType));
  }, [categories, type]);
  const effectiveCategoryId = categoryId || eligibleCategories[0]?.id || '';
  const effectiveToAccountId = type === 'transfer'
    ? (toAccountId && toAccountId !== accountId ? toAccountId : accounts.find(account => account.id !== accountId)?.id ?? '')
    : null;
  const canSave = type !== 'all' && Number(amount) > 0 && !!accountId && (type === 'transfer' ? !!effectiveToAccountId : !!effectiveCategoryId);

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
  const saveTx = () => {
    startSaveTransition(async () => {
      const result = await updateTransactionAction({
        id: tx.id,
        type,
        amount: Number(amount),
        date,
        accountId,
        toAccountId: effectiveToAccountId,
        categoryId: type === 'transfer' ? null : effectiveCategoryId,
        note,
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      setIsEditing(false);
      router.refresh();
      router.push(`/transactions?id=${tx.id}&month=${activeMonth}`);
    });
  };

  return (
    <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: T.dark }}>Szczegóły</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            aria-label={isEditing ? 'Anuluj edycję' : 'Edytuj transakcję'}
            onClick={() => setIsEditing(value => !value)}
            style={{ color: isEditing ? T.expense : T.accent, padding: 4, border: 'none', background: 'none', cursor: 'pointer' }}
          >
            {isEditing ? <X size={18} /> : <Pencil size={18} />}
          </button>
          <button aria-label="Zamknij szczegóły" onClick={onClose} style={{ color: T.muted, padding: 4, border: 'none', background: 'none', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>
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

      {isEditing && (
        <Card style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 6, background: T.bg, borderRadius: T.radiusSm, padding: 4 }}>
            {(['expense', 'income', 'transfer'] as const).map(item => (
              <button
                key={item}
                onClick={() => setType(item)}
                style={{
                  flex: 1,
                  padding: '7px 8px',
                  borderRadius: 6,
                  background: type === item ? T.card : 'transparent',
                  color: type === item ? T.accent : T.muted,
                  fontWeight: 800,
                }}
              >
                {item === 'expense' ? 'Wydatek' : item === 'income' ? 'Przychód' : 'Transfer'}
              </button>
            ))}
          </div>

          <input
            aria-label="Kwota transakcji"
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={event => setAmount(event.target.value)}
            style={inputStyle}
          />
          <input
            aria-label="Data transakcji"
            type="date"
            value={date}
            onChange={event => setDate(event.target.value)}
            style={inputStyle}
          />
          <select aria-label="Konto transakcji" value={accountId} onChange={event => setAccountId(event.target.value)} style={inputStyle}>
            {accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
          </select>
          {type === 'transfer' ? (
            <select aria-label="Konto docelowe transakcji" value={effectiveToAccountId ?? ''} onChange={event => setToAccountId(event.target.value)} style={inputStyle}>
              {accounts.filter(account => account.id !== accountId).map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
            </select>
          ) : (
            <select aria-label="Kategoria transakcji" value={effectiveCategoryId} onChange={event => setCategoryId(event.target.value)} style={inputStyle}>
              {eligibleCategories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          )}
          <input
            aria-label="Notatka transakcji"
            value={note}
            onChange={event => setNote(event.target.value)}
            placeholder="Notatka"
            style={inputStyle}
          />
          <button
            onClick={saveTx}
            disabled={!canSave || isSaving}
            style={{ height: 38, borderRadius: T.radiusSm, background: T.accent, color: 'white', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: !canSave || isSaving ? 0.55 : 1 }}
          >
            <Save size={16} color="white" />
            {isSaving ? 'Zapisywanie...' : 'Zapisz zmiany'}
          </button>
        </Card>
      )}

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {([
          { label: 'Data', value: tx.date.split('-').reverse().join('.') },
          { label: 'Konto', value: tx.acc },
          tx.toAccountName ? { label: 'Do konta', value: tx.toAccountName } : null,
          tx.photos.length > 0 ? { label: 'Zdjęcia', value: String(tx.photos.length) } : null,
          tx.desc ? { label: 'Opis', value: tx.desc } : null,
          tx.loc ? { label: 'Miejsce', value: tx.loc } : null,
        ].filter(Boolean) as { label: string; value: string }[]).map((row, i, arr) => (
          <div key={row.label} style={{ padding: '13px 16px', display: 'flex', justifyContent: 'space-between', gap: 12, borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : 'none' }}>
            <span style={{ fontSize: 14, color: T.muted }}>{row.label}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: T.mid, textAlign: 'right' }}>{row.value}</span>
          </div>
        ))}
      </Card>

      {tx.photos.length > 0 && (
        <Card style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.dark, fontSize: 14, fontWeight: 850, marginBottom: 12 }}>
            <Camera size={17} color={T.accent} /> Zdjęcia transakcji
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(82px,1fr))', gap: 10 }}>
            {tx.photos.map(photo => (
              <div key={photo.id} style={{ aspectRatio: '1', borderRadius: 12, overflow: 'hidden', background: T.bg, border: `1px solid ${T.border}`, display: 'grid', placeItems: 'center' }}>
                {photo.imageBase64 ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`data:${photo.mimeType};base64,${photo.imageBase64}`} alt="Zdjęcie transakcji" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <ImageIcon size={24} color={T.muted} />
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

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
  const [minAmount, setMinAmount] = useQueryState('min', parseAsString.withDefault(''));
  const [maxAmount, setMaxAmount] = useQueryState('max', parseAsString.withDefault(''));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, startBulkDeleteTransition] = useTransition();

  const selectedTx = useMemo(
    () => selectedId ? allTransactions.find(t => t.id === selectedId) ?? null : null,
    [allTransactions, selectedId]
  );

  const filtered = useMemo(() => {
    const textQuery = query.trim().toLocaleLowerCase('pl-PL');
    const categoryFilterIds = categoryId === 'all' ? null : categoryAndDescendantIds(categories, categoryId);
    const min = minAmount.trim() ? Number(minAmount) : null;
    const max = maxAmount.trim() ? Number(maxAmount) : null;
    return allTransactions.filter(t => {
      const absoluteAmount = Math.abs(t.amount);
      if (activeMonth !== 'all' && !t.date.startsWith(activeMonth)) return false;
      if (filter !== 'all' && t.type !== filter) return false;
      if (accountId !== 'all' && t.accountId !== accountId && t.toAccountId !== accountId) return false;
      if (categoryFilterIds && (!t.categoryId || !categoryFilterIds.has(t.categoryId))) return false;
      if (min !== null && !Number.isNaN(min) && absoluteAmount < min) return false;
      if (max !== null && !Number.isNaN(max) && absoluteAmount > max) return false;
      if (!textQuery) return true;
      return [t.cat, t.desc, t.acc, t.toAccountName, t.loc, t.amount.toString()]
        .filter(Boolean)
        .some(value => String(value).toLocaleLowerCase('pl-PL').includes(textQuery));
    });
  }, [accountId, activeMonth, allTransactions, categories, categoryId, filter, maxAmount, minAmount, query]);
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
  const resetFilters = useCallback(() => {
    void setQuery('');
    void setAccountId('all');
    void setCategoryId('all');
    void setMinAmount('');
    void setMaxAmount('');
    void setFilter('all');
  }, [setAccountId, setCategoryId, setFilter, setMaxAmount, setMinAmount, setQuery]);

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

          <Card className="transaction-filter-card" style={{ padding: 12, display: 'grid', gridTemplateColumns: '1.2fr .8fr .9fr .9fr .6fr .6fr auto auto', gap: 10, alignItems: 'center' }}>
            <input
              aria-label="Szukaj transakcji"
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
            <input
              aria-label="Kwota od"
              type="number"
              min="0"
              step="0.01"
              value={minAmount}
              onChange={e => void setMinAmount(e.target.value)}
              placeholder="Od"
              style={selectStyle}
            />
            <input
              aria-label="Kwota do"
              type="number"
              min="0"
              step="0.01"
              value={maxAmount}
              onChange={e => void setMaxAmount(e.target.value)}
              placeholder="Do"
              style={selectStyle}
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', fontSize: 13, color: T.muted, whiteSpace: 'nowrap' }}>
              <strong style={{ color: T.income }}>+{income.toLocaleString('pl-PL', { maximumFractionDigits: 0 })} zł</strong>
              <strong style={{ color: T.expense }}>-{expense.toLocaleString('pl-PL', { maximumFractionDigits: 0 })} zł</strong>
            </div>
            <button
              aria-label="Wyczyść filtry"
              onClick={resetFilters}
              style={{ height: 38, width: 38, borderRadius: T.radiusSm, background: T.bg, color: T.muted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <RotateCcw size={16} />
            </button>
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
          <TxDetailPanel
            tx={selectedTx}
            accounts={accounts}
            categories={categories}
            activeMonth={activeMonth}
            onClose={deselectTx}
          />
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

const inputStyle: CSSProperties = {
  height: 38,
  border: `1px solid ${T.border}`,
  borderRadius: T.radiusSm,
  padding: '0 10px',
  font: 'inherit',
  color: T.mid,
  background: T.card,
  outline: 'none',
};
