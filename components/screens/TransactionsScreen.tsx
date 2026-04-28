'use client';
import { memo, useCallback, useMemo, useState } from 'react';
import { ColumnDef, SortingState, flexRender, getCoreRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table';
import { parseAsStringLiteral, useQueryState } from 'nuqs';
import { ArrowUpDown, MapPin, X } from 'lucide-react';
import { T } from '@/lib/tokens';
import { fmtPLN } from '@/lib/utils';
import { Transaction } from '@/lib/data';
import { useAppData } from '@/lib/AppDataContext';
import { useSumaUiStore } from '@/lib/stores/ui-store';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Icon from '@/components/ui/Icon';

const TX_FILTERS = ['all', 'expense', 'income'] as const;
type TxFilter = typeof TX_FILTERS[number];

function TxDetailPanel({ tx, onClose }: { tx: Transaction; onClose: () => void }) {
  const amtColor = tx.type === 'expense' ? T.expense : tx.type === 'income' ? T.income : T.mid;
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
          {tx.type === 'expense' ? '-' : tx.type === 'income' ? '+' : ''}{fmtPLN(Math.abs(tx.amount))}
        </div>
        <div style={{ fontSize: 15, color: T.muted, marginTop: 4 }}>{tx.cat}</div>
      </Card>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {([
          { label: 'Data', value: tx.date.split('-').reverse().join('.') },
          { label: 'Konto', value: tx.acc },
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
    </div>
  );
}

interface TransactionsTableProps {
  transactions: Transaction[];
  onSelect: (tx: Transaction) => void;
}

const TransactionsTable = memo(function TransactionsTable({ transactions, onSelect }: TransactionsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'date', desc: true }]);

  const columns = useMemo<ColumnDef<Transaction>[]>(() => [
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
            {tx.type === 'expense' ? '-' : tx.type === 'income' ? '+' : ''}{fmtPLN(Math.abs(tx.amount))}
          </span>
        );
      },
    },
  ], []);

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
                  width: header.column.id === 'category' ? '46%' : header.column.id === 'amount' ? '18%' : '18%',
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
  const { transactions } = useAppData();
  const [filter, setFilter] = useQueryState('type', parseAsStringLiteral(TX_FILTERS).withDefault('all'));
  const selectedId = useSumaUiStore(state => state.selectedTransactionId);
  const selectTransaction = useSumaUiStore(state => state.selectTransaction);
  const clearSelectedTransaction = useSumaUiStore(state => state.clearSelectedTransaction);

  const selectedTx = useMemo(
    () => selectedId ? transactions.find(t => t.id === selectedId) ?? null : null,
    [selectedId, transactions]
  );

  const filtered = useMemo(
    () => transactions.filter(t => filter === 'all' || t.type === filter),
    [filter, transactions]
  );

  const setTypedFilter = useCallback((value: TxFilter) => {
    void setFilter(value);
  }, [setFilter]);
  const selectTx = useCallback((tx: Transaction) => {
    selectTransaction(tx.id);
  }, [selectTransaction]);
  const deselectTx = useCallback(() => {
    clearSelectedTransaction();
  }, [clearSelectedTransaction]);

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: 28 }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
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
              {f === 'all' ? 'Wszystkie' : f === 'expense' ? 'Wydatki' : 'Przychody'}
            </button>
          ))}
        </div>

        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <TransactionsTable transactions={filtered} onSelect={selectTx} />
        </Card>
      </div>

      {selectedTx && (
        <div style={{ width: 340, borderLeft: `1px solid ${T.border}`, overflowY: 'auto', background: T.card }}>
          <TxDetailPanel tx={selectedTx} onClose={deselectTx} />
        </div>
      )}
    </div>
  );
}
