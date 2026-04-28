<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes. APIs, conventions, and file structure may differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Suma Web Stack Guidance

Suma Web is a companion product to the mobile app, not a full mobile replacement. Build it as a desktop-first finance workspace for review, analysis, imports, exports, budgets, and data cleanup.

## Architecture

- Prefer Server Components for pages, layouts, data loading, and read-only views.
- Use Client Components only for local interactivity: forms, filters, modals, drawers, tables, optimistic UI, browser APIs.
- Keep sensitive auth/session logic server-side. Do not expose access or refresh tokens to Client Components.
- Treat the API sync response as untrusted external data. Validate payloads at boundaries before mapping to UI models.

## Recommended Libraries

Install libraries only when a feature needs them. Prefer these choices when the need appears:

- Validation and API contracts: `zod`.
- Forms: `react-hook-form`, `@hookform/resolvers`, `zod`.
- Server mutations: native Server Actions first. Add `next-safe-action` only when actions become numerous and need typed middleware/structured results.
- Client server-state cache: `@tanstack/react-query` for live client workflows, pagination, polling, optimistic mutations, import progress, and repeated client-side queries. Do not use it for simple Server Component reads.
- Client UI state: `zustand` for cross-component UI state only, such as active month, open panels, selected transaction, import wizard draft state, table preferences. Do not store canonical server data in Zustand.
- Tables/data grids: `@tanstack/react-table` for transaction history, imports, budgets, and bulk edit screens.
- URL state: `nuqs` for filters, sorting, pagination, and date ranges that should survive refresh/share. Keep ephemeral selected row/panel state in Zustand unless sharing that exact row is a product requirement.
- Charts: `recharts` for standard finance charts. Avoid custom SVG chart logic unless the chart is trivial.
- Dates: `date-fns` for formatting, month ranges, comparisons, and date arithmetic.
- Toasts: `sonner`.
- Accessible primitives: Radix UI packages as needed, especially dialogs, dropdowns, popovers, tabs, switches, tooltips.
- Command/search UI: `cmdk` when building global search or command palette.
- Tests: `vitest`, `@testing-library/react`, `@testing-library/user-event`, `jsdom`, `msw`, `@playwright/test`.

## State Ownership

- Server data belongs to the server/API cache, not to global client state.
- Zustand may hold UI state and temporary drafts only.
- React local state is enough for isolated controls.
- URL state is preferred for table filters, sorting, pagination, month, and report range. Ephemeral row selection belongs in UI state.
- TanStack Query is appropriate when the browser owns an ongoing interaction: infinite lists, optimistic updates, polling, import progress, or background refresh.

## Finance Product Defaults

- Transaction screens should be table-first on desktop: filterable, sortable, keyboard-friendly, and suitable for bulk actions.
- Every mutation must show pending, success, and error states.
- Imports need preview, mapping, validation, duplicate detection, and explicit confirmation.
- Budget and reporting screens should preserve selected month/range in the URL.
- Prefer large, readable typography and dense-but-clear layouts over decorative cards.

## Local Development

- Local test account: `root@root.com` / `root1234!`.

## Testing Expectations

- Unit-test mappers, validators, date helpers, and money calculations with Vitest.
- Component-test forms, filters, and important empty/error states with Testing Library.
- Mock network behavior with MSW.
- Cover critical flows with Playwright: login, dashboard load, transaction filtering, import preview/confirm, budget editing.
- Run `npm run lint` and `npm run build` before claiming web work is complete.

## Avoid

- Do not add Redux unless requirements change substantially; it is unnecessary for the current app shape.
- Do not put canonical synced finance data into Zustand.
- Do not add a heavy component framework before confirming the design direction.
- Do not hand-roll complex tables, forms, date math, or charts when the recommended libraries cover the need.
