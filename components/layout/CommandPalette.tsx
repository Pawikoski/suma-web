'use client';

import { Command } from 'cmdk';
import * as Dialog from '@radix-ui/react-dialog';
import { useRouter } from 'next/navigation';
import { BarChart2, ClipboardList, HandCoins, Home, Repeat2, Search, Tag, UploadCloud, Wallet } from 'lucide-react';
import { useActiveMonthData } from '@/lib/useActiveMonthData';
import { useSumaUiStore } from '@/lib/stores/ui-store';
import { fmtPLN } from '@/lib/utils';

const QUICK_LINKS = [
  { label: 'Home', href: '/', Icon: Home },
  { label: 'Transakcje', href: '/transactions', Icon: ClipboardList },
  { label: 'Opłaty stałe', href: '/recurring', Icon: Repeat2 },
  { label: 'Rozliczenia', href: '/settlements', Icon: HandCoins },
  { label: 'Kategorie', href: '/categories', Icon: Tag },
  { label: 'Konta', href: '/accounts', Icon: Wallet },
  { label: 'Budżet', href: '/budget', Icon: BarChart2 },
  { label: 'Raporty', href: '/reports', Icon: BarChart2 },
  { label: 'Import/eksport', href: '/import-export', Icon: UploadCloud },
] as const;

export default function CommandPalette() {
  const router = useRouter();
  const { accounts, categories, allTransactions, activeMonth } = useActiveMonthData();
  const open = useSumaUiStore(state => state.isCommandOpen);
  const close = useSumaUiStore(state => state.closeCommand);
  const navHref = (href: string) => href.includes('?')
    ? `${href}&month=${encodeURIComponent(activeMonth)}`
    : `${href}?month=${encodeURIComponent(activeMonth)}`;

  const run = (href: string) => {
    close();
    router.push(navHref(href));
  };

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => { if (!nextOpen) close(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="command-backdrop" />
        <Dialog.Content className="command-dialog-content" aria-describedby={undefined}>
          <Dialog.Title className="visually-hidden">Szukaj w Suma</Dialog.Title>
      <div className="command-panel">
        <Command label="Szukaj w Suma">
        <div className="command-input-row">
          <Search size={18} />
          <Command.Input autoFocus placeholder="Szukaj transakcji, kont, kategorii..." />
        </div>
        <Command.List>
          <Command.Empty>Brak wyników</Command.Empty>

          <Command.Group heading="Widoki">
            {QUICK_LINKS.map(({ label, href, Icon }) => (
              <Command.Item key={href} value={`widok ${label}`} onSelect={() => run(href)}>
                <Icon size={18} />
                <span>{label}</span>
              </Command.Item>
            ))}
          </Command.Group>

          <Command.Group heading="Ostatnie transakcje">
            {allTransactions.slice(0, 8).map(tx => (
              <Command.Item key={tx.id} value={`${tx.cat} ${tx.desc} ${tx.acc} ${tx.amount}`} onSelect={() => run(`/transactions?id=${tx.id}`)}>
                <ClipboardList size={18} />
                <span>{tx.cat}</span>
                <small>{tx.desc || tx.acc}</small>
                <strong>{fmtPLN(Math.abs(tx.amount))}</strong>
              </Command.Item>
            ))}
          </Command.Group>

          <Command.Group heading="Konta">
            {accounts.map(account => (
              <Command.Item key={account.id} value={`konto ${account.name} ${account.type}`} onSelect={() => run(`/accounts?account=${account.id}`)}>
                <Wallet size={18} />
                <span>{account.name}</span>
                <small>{account.type}</small>
                <strong>{fmtPLN(account.balance)}</strong>
              </Command.Item>
            ))}
          </Command.Group>

          <Command.Group heading="Kategorie">
            {categories.slice(0, 12).map(category => (
              <Command.Item key={category.id} value={`kategoria ${category.name}`} onSelect={() => run(`/transactions?category=${category.id}`)}>
                <Tag size={18} />
                <span>{category.name}</span>
                <small>{category.txCount} transakcji</small>
                <strong>{fmtPLN(category.spent)}</strong>
              </Command.Item>
            ))}
          </Command.Group>
        </Command.List>
        </Command>
      </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
