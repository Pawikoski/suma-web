'use client';

import { CSSProperties, ChangeEvent, useMemo, useState, useTransition } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileJson, FileSpreadsheet, UploadCloud } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { confirmImportAnalysisAction } from '@/app/actions/sync';
import { T } from '@/lib/tokens';
import { useActiveMonthData } from '@/lib/useActiveMonthData';
import { ImportAnalysis } from '@/lib/schemas/import-analysis';
import { fmtPLN } from '@/lib/utils';
import Card from '@/components/ui/Card';
import PrivacyAmount from '@/components/ui/PrivacyAmount';

type ImportState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'ready'; fileName: string; analysis: ImportAnalysis };

const ACCEPTED_IMPORT_TYPES = '.csv,.json,.xls,.xlsx,.xml';

function fileFormatLabel(format: string) {
  return format.toUpperCase();
}

function transactionTypeLabel(type: string) {
  if (type === 'INCOME') return 'Przychód';
  if (type === 'TRANSFER') return 'Transfer';
  return 'Wydatek';
}

export default function ImportExportScreen() {
  const router = useRouter();
  const { accounts, categories, allTransactions, recurringTransactions, settlements, investmentHoldings, accountInterest } = useActiveMonthData();
  const [state, setState] = useState<ImportState>({ status: 'idle' });
  const [isPending, startTransition] = useTransition();
  const [isConfirming, startConfirmTransition] = useTransition();

  const duplicateCount = useMemo(() => {
    if (state.status !== 'ready') return 0;
    const existing = new Set(allTransactions.map(tx => `${tx.date}|${Math.abs(tx.amount).toFixed(2)}|${(tx.desc || '').toLocaleLowerCase('pl-PL')}`));
    return state.analysis.transactions.filter(tx => existing.has(`${tx.date}|${tx.amount.toFixed(2)}|${(tx.notes || '').toLocaleLowerCase('pl-PL')}`)).length;
  }, [allTransactions, state]);

  const analyzeFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    startTransition(async () => {
      const body = new FormData();
      body.set('file', file);

      const response = await fetch('/api/imports/analyze', {
        method: 'POST',
        body,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setState({ status: 'error', message: payload?.detail ?? 'Nie udało się przeanalizować pliku.' });
        return;
      }

      setState({ status: 'ready', fileName: file.name, analysis: payload as ImportAnalysis });
    });
  };

  const exportCounts = [
    { label: 'Transakcje', value: allTransactions.length },
    { label: 'Konta', value: accounts.length },
    { label: 'Kategorie', value: categories.length },
    { label: 'Stałe', value: recurringTransactions.length },
    { label: 'Rozliczenia', value: settlements.length },
    { label: 'Inwestycje', value: investmentHoldings.length },
    { label: 'Odsetki', value: accountInterest.length },
  ];

  const confirmImport = () => {
    if (state.status !== 'ready') return;
    startConfirmTransition(async () => {
      const result = await confirmImportAnalysisAction(state.analysis);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message ?? 'Import został zapisany.');
      setState({ status: 'idle' });
      router.refresh();
    });
  };

  return (
    <div className="screen import-export-screen" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="import-export-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card style={{ padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: T.accentLight, display: 'grid', placeItems: 'center' }}>
              <Download size={22} color={T.accent} />
            </div>
            <div>
              <h1 style={{ color: T.dark, fontSize: 20, fontWeight: 850 }}>Eksport</h1>
              <div style={{ color: T.muted, fontSize: 13 }}>JSON zgodny z aktualnym kontraktem sync</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(96px,1fr))', gap: 10, marginBottom: 18 }}>
            {exportCounts.map(item => (
              <div key={item.label} style={{ border: `1px solid ${T.border}`, borderRadius: T.radiusSm, padding: 12 }}>
                <div style={{ color: T.dark, fontSize: 24, fontWeight: 850 }}>{item.value}</div>
                <div style={{ color: T.muted, fontSize: 12, fontWeight: 700 }}>{item.label}</div>
              </div>
            ))}
          </div>
          <a
            href="/api/export/sync"
            download
            style={{ height: 42, padding: '0 14px', borderRadius: T.radiusSm, background: T.accent, color: 'white', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}
          >
            <FileJson size={18} color="white" /> Pobierz JSON
          </a>
        </Card>

        <Card style={{ padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: T.incomeSoft, display: 'grid', placeItems: 'center' }}>
              <UploadCloud size={22} color={T.income} />
            </div>
            <div>
              <h1 style={{ color: T.dark, fontSize: 20, fontWeight: 850 }}>Import</h1>
              <div style={{ color: T.muted, fontSize: 13 }}>CSV, JSON, XLS, XLSX, XML</div>
            </div>
          </div>
          <label
            style={{ display: 'flex', minHeight: 112, border: `1px dashed ${T.accentMid}`, borderRadius: T.radius, background: T.accentLight, alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: T.accent, fontWeight: 850, cursor: 'pointer', padding: 18 }}
          >
            <input type="file" accept={ACCEPTED_IMPORT_TYPES} onChange={analyzeFile} style={{ display: 'none' }} />
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileSpreadsheet size={20} /> {isPending ? 'Analizuję plik...' : 'Wybierz plik'}
            </span>
          </label>
          {state.status === 'error' && (
            <div style={{ marginTop: 12, display: 'flex', gap: 8, color: T.expense, fontSize: 13, fontWeight: 700 }}>
              <AlertTriangle size={16} /> {state.message}
            </div>
          )}
        </Card>
      </div>

      {state.status === 'ready' && (
        <ImportPreview
          fileName={state.fileName}
          analysis={state.analysis}
          duplicateCount={duplicateCount}
          isConfirming={isConfirming}
          onConfirm={confirmImport}
        />
      )}
    </div>
  );
}

function ImportPreview({
  fileName,
  analysis,
  duplicateCount,
  isConfirming,
  onConfirm,
}: {
  fileName: string;
  analysis: ImportAnalysis;
  duplicateCount: number;
  isConfirming: boolean;
  onConfirm: () => void;
}) {
  const totalExpense = analysis.transactions
    .filter(tx => tx.type === 'EXPENSE')
    .reduce((sum, tx) => sum + tx.amount, 0);
  const confidencePct = Math.round(analysis.confidence * 100);
  const confidenceColor = confidencePct >= 70 ? T.income : confidencePct >= 40 ? T.warn : T.expense;

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <div className="import-preview-header" style={{ padding: 18, borderBottom: `1px solid ${T.border}`, display: 'grid', gridTemplateColumns: '1.2fr .6fr .6fr .6fr auto', gap: 12, alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.dark, fontWeight: 850 }}>
            <CheckCircle2 size={18} color={confidenceColor} /> {fileName}
          </div>
          <div style={{ color: T.muted, fontSize: 12, marginTop: 3 }}>
            {analysis.source_app || 'Nieznane źródło'} · {fileFormatLabel(analysis.source_format)}
          </div>
        </div>
        <PreviewStat label="Pewność mapowania" value={`${confidencePct}%`} color={confidenceColor} />
        <PreviewStat label="Transakcje" value={analysis.transactions.length} />
        <PreviewStat label="Duplikaty" value={duplicateCount} color={duplicateCount > 0 ? T.warn : T.income} />
        <button
          onClick={onConfirm}
          disabled={isConfirming || analysis.transactions.length === 0}
          style={{ height: 40, padding: '0 14px', borderRadius: T.radiusSm, background: T.income, color: 'white', fontWeight: 850, opacity: isConfirming ? .65 : 1 }}
        >
          {isConfirming ? 'Importuję...' : 'Zatwierdź import'}
        </button>
      </div>

      {duplicateCount > 0 && (
        <div style={{ padding: '10px 18px', background: T.warnSoft, color: '#92400e', fontSize: 13, fontWeight: 700 }}>
          Wykryto możliwe duplikaty po dacie, kwocie i opisie. Przejrzyj podgląd przed importem.
        </div>
      )}

      <div className="import-preview-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 0 }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
            <thead>
              <tr style={{ background: T.bg, color: T.muted, fontSize: 12, textAlign: 'left' }}>
                <th style={thStyle}>Data</th>
                <th style={thStyle}>Typ</th>
                <th style={thStyle}>Konto</th>
                <th style={thStyle}>Kategoria / konto</th>
                <th style={thStyle}>Opis</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Kwota</th>
              </tr>
            </thead>
            <tbody>
              {analysis.transactions.slice(0, 30).map((tx, index) => (
                <tr key={`${tx.date}-${tx.amount}-${index}`} style={{ borderTop: `1px solid ${T.border}` }}>
                  <td style={tdStyle}>{tx.date}</td>
                  <td style={tdStyle}>{transactionTypeLabel(tx.type)}</td>
                  <td style={tdStyle}>{tx.from_account}</td>
                  <td style={tdStyle}>{tx.type === 'TRANSFER' ? tx.to_account : [tx.to_category_parent, tx.to_category || 'Inne'].filter(Boolean).join(' / ')}</td>
                  <td style={{ ...tdStyle, color: T.muted }}>{tx.notes || '-'}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: tx.type === 'EXPENSE' ? T.expense : T.income, fontWeight: 850 }}>
                    <PrivacyAmount amount={tx.type === 'EXPENSE' ? -tx.amount : tx.amount} signed />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {analysis.transactions.length > 30 && (
            <div style={{ padding: 14, color: T.muted, fontSize: 13, borderTop: `1px solid ${T.border}` }}>
              Pokazano 30 z {analysis.transactions.length} transakcji.
            </div>
          )}
        </div>

        <aside style={{ borderLeft: `1px solid ${T.border}`, padding: 16, background: '#fbfdff' }}>
          <div style={{ color: T.dark, fontSize: 14, fontWeight: 850, marginBottom: 12 }}>Konta w pliku</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
            {analysis.accounts.length === 0 && <div style={{ color: T.faint, fontSize: 13 }}>Brak kont w pliku</div>}
            {analysis.accounts.slice(0, 8).map(account => (
              <div key={account.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13 }}>
                <span style={{ color: T.mid, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{account.name}</span>
                <span style={{ color: T.muted, flexShrink: 0 }}>{account.balance === null ? account.currency : fmtPLN(account.balance)}</span>
              </div>
            ))}
          </div>
          <div style={{ color: T.dark, fontSize: 14, fontWeight: 850, marginBottom: 8 }}>Suma wydatków</div>
          <PrivacyAmount amount={totalExpense} style={{ display: 'block', color: T.expense, fontSize: 24, fontWeight: 850 }} />
        </aside>
      </div>
    </Card>
  );
}

function PreviewStat({ label, value, color = T.dark }: { label: string; value: string | number; color?: string }) {
  return (
    <div>
      <div style={{ color, fontSize: 22, fontWeight: 850 }}>{value}</div>
      <div style={{ color: T.muted, fontSize: 12, fontWeight: 700 }}>{label}</div>
    </div>
  );
}

const thStyle: CSSProperties = {
  padding: '10px 12px',
  fontWeight: 800,
};

const tdStyle: CSSProperties = {
  padding: '11px 12px',
  color: T.mid,
  fontSize: 13,
  verticalAlign: 'top',
};
