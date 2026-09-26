import type { SyncAccount } from './api-types';
import type { ImportAnalysis } from './schemas/import-analysis';

const normalize = (value: string) => value.normalize('NFC').trim().toLocaleLowerCase('pl-PL');

/** Validate the entire proposed graph before generating IDs or submitting it. */
export function importPreflight(analysis: ImportAnalysis, existing: SyncAccount[]): string | null {
  const currencies = new Map<string, string>();
  const references = [...analysis.accounts.map(account => ({ name: account.name, currency: account.currency }))];
  for (const [index, row] of analysis.transactions.entries()) {
    if (!row.from_account.trim()) return `Wiersz ${index + 1}: przypisz konto źródłowe przed importem.`;
    references.push({ name: row.from_account, currency: row.currency });
    if (row.type !== 'TRANSFER') continue;
    if (!row.to_account?.trim()) {
      if (!analysis.allow_missing_destination) return 'Potwierdź zachowanie historycznych przelewów bez celu lub przypisz ich konta docelowe.';
      continue;
    }
    if (normalize(row.from_account) === normalize(row.to_account)) return `Wiersz ${index + 1}: konta przelewu muszą być różne.`;
    if (row.currency2 && row.currency2 !== row.currency && !row.amount2) return `Wiersz ${index + 1}: przelew walutowy wymaga kwoty w walucie celu.`;
    references.push({ name: row.to_account, currency: row.currency2 ?? row.currency });
  }
  for (const ref of references) {
    if (!ref.name.trim()) return 'Uzupełnij nazwę konta w podglądzie importu.';
    const name = normalize(ref.name);
    if (currencies.has(name) && currencies.get(name) !== ref.currency) return `Konto „${ref.name}” występuje w różnych walutach. Rozdziel je przed importem.`;
    currencies.set(name, ref.currency);
    const matches = existing.filter(account => !account.deleted_at && normalize(account.name) === name);
    if (matches.length > 1) return `Nazwa „${ref.name}” wskazuje kilka kont. Zmień mapowanie przed importem.`;
    if (matches[0] && (!matches[0].is_active || matches[0].currency !== ref.currency)) {
      return `Konto „${ref.name}” jest nieaktywne lub ma inną walutę. Zmień mapowanie przed importem.`;
    }
  }
  return null;
}
