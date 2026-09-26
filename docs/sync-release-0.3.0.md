# Synchronization release 0.3.0

## Problem and changes

Historical Android transfers can have a known source and no destination. The v3
contract explicitly represents them as `MISSING_DESTINATION` with a reason.
Web now reads and writes v3 and retains these fields, original currency details,
merchant/asset/recurring metadata, and deletion tombstones.

- Editing a history note preserves the unknown destination and its monetary data.
  The form does not select an unrelated account automatically.
- Resolving a destination requires confirmation of its balance effect. The API
  receives the preserved destination amount, including currency conversions.
  A currency mismatch or missing foreign amount requires correction on mobile.
- Transaction creation, edits, and deletion send ledger records; account balance
  reconciliation belongs to the API. Receipt splits survive note-only edits.
- Transaction edits carry the version viewed by the user, preventing a stale form
  from silently adopting a newer server version and overwriting it.
- Every server action binds its mutation to the reset generation it read. A cloud
  reset between read and write requires a fresh read instead of replaying history.
- Paging restarts discard obsolete snapshot rows but retain the write outcome.
  A client-wins conflict is recognized as accepted; server-wins is surfaced.
- Transport, response-body and 5xx retries replay the identical request identity
  and body. Permanent 400/409/429 failures are not automatically retried. Safe
  messages cross the server-action boundary instead of raw API bodies.
- Imports preflight all records before sending one atomic graph. Missing sources,
  ambiguous normalized names, inactive accounts, currency mismatch and invalid
  amounts/dates prevent writing. No fallback `Import` or `Transfer` accounts are
  created. Missing destinations require explicit consent in the preview.
- Preview mapping can assign existing accounts or name real new accounts. A
  failure to create any account is an import failure, never partial success.
  Existing account balances receive only new ledger effects; file closing balances
  apply to newly created accounts. Original/source/destination amounts are distinct.
- Create/import drafts use stable submission and entity UUIDs. A retry first
  checks which transaction identities already exist; a completed batch is
  acknowledged without another write, while a partial batch requires inspection.
  An identity-only per-user localStorage marker survives reload. Unknown outcomes
  freeze the draft, allow replaying the same captured input, and block new writes
  until reconciliation or explicit acknowledgement after checking server history.
- Import file selection waits for hydration, prevents overlapping submissions,
  and allows selecting the same file again after a failed analysis.

## Verification

Run from `suma-web`:

```bash
npm run test
npm run lint
npm run build
```

Local HTTP and browser tests require an explicitly configured disposable local
API, synthetic Premium/sync-enabled user, a source account `HTTP web release`
(PLN), a destination `HTTP destination` (EUR), a category matching the source
name, more than 250 transactions, and at least one historical missing destination.
Provide `SYNC_HTTP_API_URL` (`http://127.0.0.1:<port>`), `SYNC_HTTP_EMAIL`, and
`SYNC_HTTP_PASSWORD` via the environment. Keep these values out of Git. Start
web with `API_URL` pointing to the same local API and a local `SESSION_SECRET`.

```bash
npm run test -- lib/sync-http.integration.test.ts
npm run e2e -- e2e/sync-history.spec.ts
```

HTTP coverage: paged graph, lost response after commit, concurrent expenses,
history note without balance change, foreign destination resolution, and a stale
history upload that must not reverse a resolved destination. Browser coverage:
the actual history edit/resolve server-action flow and native Suma CSV preview,
consent, import, and retained original/source/destination amounts.
The browser suite also loses the Next server-action response after the API
commits, retries the exact create/import draft, checks that just one transaction
exists, and verifies recovery from the persisted marker after a page reload.

Verified locally on 2026-09-26: 103 Vitest tests (2 opt-in HTTP tests skipped in the
default run and passed separately), ESLint, production Next build,
2 real HTTP integration tests on isolated PostgreSQL, and all 4 Chromium flows.
The marker/reload path was additionally rerun after its final assertion was added.
No production host or user data was used for these tests.

## Rollout and limits

Deploy the compatible API and schema migration before web 0.3.0 and Android v3.
All active clients must understand v3 before introducing history states/backfill;
an older client gets a controlled upgrade-required response for such a dataset.
These changes do not run a production backfill or alter production data.

The web app remains an online client without a full durable mutation outbox.
Create/import retain stable entity identities and reconcile previous commits on
retry. The browser stores only submission ID, timestamp and expected record
count; financial form contents remain in memory. After a reload, the marker
blocks a new operation until checking the result on the server. If records are
not all found, the user must inspect history and explicitly acknowledge before
starting a new operation. This avoids pretending an unknown response is a failed
commit while keeping financial data out of browser storage.

The original private incident ZIP was unavailable during this release pass.
Synthetic datasets demonstrate protocol and balance behavior; they do not prove
the historical cause or substitute for restoring that exact private backup.
