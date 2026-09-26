'use client';

import { CSSProperties, ChangeEvent, useMemo, useRef, useState, useSyncExternalStore, useTransition } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileJson, FileSpreadsheet, UploadCloud } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { confirmImportAnalysisAction } from '@/app/actions/sync';
import { T } from '@/lib/tokens';
import { useActiveMonthData } from '@/lib/useActiveMonthData';
import { ImportAnalysis, importAnalysisSchema } from '@/lib/schemas/import-analysis';
import { formatMoney, fallbackCurrency } from '@/lib/utils';
import Card from '@/components/ui/Card';
import PrivacyAmount from '@/components/ui/PrivacyAmount';
import SubmissionRecovery from '@/components/ui/SubmissionRecovery';
import { useSubmissionGuard } from '@/lib/useSubmissionGuard';

type ImportState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'ready'; fileName: string; analysis: ImportAnalysis };

const subscribeHydration = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

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
  const hydrated = useSyncExternalStore(subscribeHydration, clientReady, serverReady);
  const { accounts, categories, allTransactions, recurringTransactions, settlements, investmentHoldings, accountInterest, baseCurrency, userEmail } = useActiveMonthData();
  const submission = useSubmissionGuard(userEmail, 'import');
  const retryInput = useRef<Record<string, unknown> | null>(null);
  const [hasRetry, setHasRetry] = useState(false);
  const [state, setState] = useState<ImportState>({ status: 'idle' });
  const [accountMappings, setAccountMappings] = useState<Record<string, string>>({});
  const [allowMissingDestination, setAllowMissingDestination] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isConfirming, startConfirmTransition] = useTransition();

  const duplicateCount = useMemo(() => {
    if (state.status !== 'ready') return 0;
    const existing = new Set(allTransactions.map(tx => `${tx.date}|${Math.abs(tx.amount).toFixed(2)}|${(tx.desc || '').toLocaleLowerCase('pl-PL')}`));
    return state.analysis.transactions.filter(tx => existing.has(`${tx.date}|${tx.amount.toFixed(2)}|${(tx.notes || '').toLocaleLowerCase('pl-PL')}`)).length;
  }, [allTransactions, state]);

  const mappingKey = (role: string, name: string | null | undefined, currency: string) => JSON.stringify([role, name ?? '', currency]);
  const references = state.status === 'ready' ? [...new Map(state.analysis.transactions.flatMap(row => [
    { role: 'source', name: row.from_account, currency: row.currency },
    ...(row.type === 'TRANSFER' ? [{ role: 'destination', name: row.to_account ?? '', currency: row.currency2 ?? row.currency }] : []),
  ]).map(ref => [mappingKey(ref.role, ref.name, ref.currency), ref])).entries()] : [];
  const mappedAnalysis = state.status === 'ready' ? {
    ...state.analysis,
    allow_missing_destination: allowMissingDestination,
    transactions: state.analysis.transactions.map(row => ({
      ...row,
      from_account: accountMappings[mappingKey('source', row.from_account, row.currency)] ?? row.from_account,
      to_account: row.type === 'TRANSFER' ? accountMappings[mappingKey('destination', row.to_account, row.currency2 ?? row.currency)] ?? row.to_account : row.to_account,
    })),
    accounts: state.analysis.accounts.map(account => ({ ...account,
      name: accountMappings[mappingKey('source', account.name, account.currency)] ?? accountMappings[mappingKey('destination', account.name, account.currency)] ?? account.name,
    })),
  } : null;
  const missingSources = mappedAnalysis?.transactions.filter(row => !row.from_account.trim()).length ?? 0;
  const missingDestinations = mappedAnalysis?.transactions.filter(row => row.type === 'TRANSFER' && !row.to_account?.trim()).length ?? 0;

  const analyzeFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    setState({ status: 'idle' });

    startTransition(async () => {
      const body = new FormData();
      body.set('file', file);

      const response = await fetch('/api/imports/analyze', { method: 'POST', body }).catch(() => null);
      if (!response) {
        setState({ status: 'error', message: 'Połączenie przerwane. Wybierz plik ponownie, aby powtórzyć analizę.' });
        return;
      }
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setState({ status: 'error', message: payload?.detail ?? 'Nie udało się przeanalizować pliku.' });
        return;
      }

      const parsed = importAnalysisSchema.safeParse(payload);
      if (!parsed.success) {
        setState({ status: 'error', message: 'Niepoprawne dane analizy importu.' });
        return;
      }
      setAccountMappings({});
      setAllowMissingDestination(false);
      setState({ status: 'ready', fileName: file.name, analysis: parsed.data });
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
    if ((!mappedAnalysis && !retryInput.current) || isConfirming) return;
    startConfirmTransition(async () => {
      if (!retryInput.current && mappedAnalysis) {
        try {
          const identity = submission.begin(mappedAnalysis.transactions.length);
          setHasRetry(true);
          retryInput.current = { ...mappedAnalysis, submissionId: identity.id, submittedAt: identity.submittedAt };
        } catch (error) { toast.error(error instanceof Error ? error.message : 'Nie można przygotować importu.'); return; }
      }
      let result;
      try { result = await confirmImportAnalysisAction(retryInput.current); }
      catch { toast.error('Nie otrzymano wyniku importu. Sprawdź wynik lub ponów tę samą próbę.'); return; }
      if (!result.ok) {
        if (!result.outcomeUnknown) { submission.finish(); retryInput.current = null; setHasRetry(false); }
        toast.error(result.message);
        return;
      }
      submission.finish();
      retryInput.current = null;
      setHasRetry(false);
      toast.success(result.message ?? 'Import został zapisany.');
      setState({ status: 'idle' });
      router.refresh();
    });
  };

  return (
    <div className="screen import-export-screen" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <SubmissionRecovery guard={submission} busy={isConfirming} onRetry={hasRetry ? confirmImport : undefined} onResolved={() => { retryInput.current = null; setHasRetry(false); setState({ status: 'idle' }); router.refresh(); }} />
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
            <input type="file" disabled={!hydrated || isPending || isConfirming || submission.blocked} accept={ACCEPTED_IMPORT_TYPES} onChange={analyzeFile} style={{ display: 'none' }} />
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

      {state.status === 'ready' && mappedAnalysis && <Card style={{ padding: 18 }}>
        <h2 style={{ fontSize: 17, color: T.dark }}>Konta importowanych transakcji</h2>
        <p style={{ color: T.muted, fontSize: 13 }}>Wybierz istniejącą nazwę lub wpisz nazwę rzeczywistego konta do utworzenia. Źródło jest wymagane. Salda istniejących kont zmienią się wyłącznie o importowane transakcje; salda z pliku dotyczą nowo tworzonych kont.</p>
        <datalist id="import-account-names">{accounts.map(account => <option key={account.id} value={account.name}>{account.currency}</option>)}</datalist>
        {references.map(([key, ref]) => <label key={key} style={{ display: 'block', marginTop: 8, fontSize: 13 }}>
          {ref.role === 'source' ? 'Źródło' : 'Cel'}: {ref.name || 'brak w pliku'} ({ref.currency})
          <input aria-label={`${ref.role === 'source' ? 'Źródło' : 'Cel'}: ${ref.name || 'brak w pliku'} (${ref.currency})`}
            disabled={submission.blocked || isConfirming} list="import-account-names" value={accountMappings[key] ?? ref.name}
            onChange={event => { setAccountMappings(current => ({ ...current, [key]: event.target.value })); setAllowMissingDestination(false); }}
            style={{ display: 'block', padding: 8, border: `1px solid ${T.border}`, borderRadius: 6, width: '100%', maxWidth: 440 }} />
        </label>)}
        {missingSources > 0 && <p role="alert" style={{ color: T.expense }}>Przypisz konto źródłowe: {missingSources} transakcji.</p>}
        {missingDestinations > 0 && <label style={{ display: 'block', marginTop: 12, color: T.dark }}>
          <input type="checkbox" disabled={submission.blocked || isConfirming} checked={allowMissingDestination} onChange={event => setAllowMissingDestination(event.target.checked)} />
          {' '}Zachowaj {missingDestinations} historycznych przelewów bez celu. Obciążą tylko znane konto źródłowe i będą synchronizowane w całości.
        </label>}
      </Card>}
      {state.status === 'ready' && mappedAnalysis && (
        <ImportPreview
          fileName={state.fileName}
          analysis={mappedAnalysis}
          duplicateCount={duplicateCount}
          baseCurrency={baseCurrency}
          isConfirming={isConfirming}
          blocked={submission.blocked || missingSources > 0 || (missingDestinations > 0 && !allowMissingDestination)}
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
  baseCurrency,
  isConfirming,
  blocked,
  onConfirm,
}: {
  fileName: string;
  analysis: ImportAnalysis;
  duplicateCount: number;
  baseCurrency: string;
  isConfirming: boolean;
  blocked: boolean;
  onConfirm: () => void;
}) {
  const totalExpense = analysis.transactions
    .filter(tx => tx.type === 'EXPENSE')
    .reduce((sum, tx) => sum + tx.amount, 0);
  const previewCurrency = fallbackCurrency(
    analysis.transactions[0]?.currency,
    analysis.accounts[0]?.currency,
    baseCurrency
  );
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
          disabled={blocked || isConfirming || analysis.transactions.length === 0}
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
                  <td style={tdStyle}>{tx.type === 'TRANSFER' ? tx.to_account || 'Cel nieznany (historia)' : [tx.to_category_parent, tx.to_category || 'Inne'].filter(Boolean).join(' / ')}</td>
                  <td style={{ ...tdStyle, color: T.muted }}>{tx.notes || '-'}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: tx.type === 'EXPENSE' ? T.expense : T.income, fontWeight: 850 }}>
                    <PrivacyAmount
                      amount={tx.type === 'EXPENSE' ? -tx.amount : tx.amount}
                      currency={fallbackCurrency(tx.currency, baseCurrency)}
                      signed
                    />
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
                <span style={{ color: T.muted, flexShrink: 0 }}>
                  {account.balance === null
                    ? fallbackCurrency(account.currency, baseCurrency)
                    : formatMoney(account.balance, fallbackCurrency(account.currency, baseCurrency))}
                </span>
              </div>
            ))}
          </div>
          <div style={{ color: T.dark, fontSize: 14, fontWeight: 850, marginBottom: 8 }}>Suma wydatków</div>
          <PrivacyAmount amount={totalExpense} currency={previewCurrency} style={{ display: 'block', color: T.expense, fontSize: 24, fontWeight: 850 }} />
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
