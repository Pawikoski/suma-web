# Suma Web

Read `../AGENTS.md` for shared workspace rules if it exists and has not already
been loaded.

## Architecture and contracts

- Next.js App Router. For framework API changes, read the relevant version-matched
  guide in `node_modules/next/dist/docs/`; restore dependencies if it is unavailable.
- Keep API credentials and session logic server-side. `lib/session.ts` owns the
  HttpOnly session cookie; `lib/api.ts` is server-only. Never pass access or refresh
  tokens to Client Components or expose server secrets through public environment variables.
- Validate API responses in `lib/schemas/` before mapping them in `lib/mappers.ts`.
  Keep schemas, `lib/api-types.ts`, and server actions aligned with `../suma-api/`.
- Financial data comes from the backend. Do not make Zustand a second authoritative
  store for synchronized records. Reuse existing data-loading and mutation paths.
- Check installed dependencies in `package.json` before introducing another library.

## Development and validation

- Use npm and preserve `package-lock.json`. `npm run dev` starts the local app.
  Server integration requires `API_URL` and `SESSION_SECRET`; keep their values local.
- For JavaScript/TypeScript changes, run `npm run lint`; for small, localized edits,
  `npm run lint -- <changed-files>` is sufficient.
- Run `npm run build` for changes affecting types, imports, dependencies, build
  configuration, routing, server/client boundaries, or API integration. Isolated
  copy or styling changes need visual verification of the affected page; a full
  build is optional unless they also affect those areas.
- Run focused Vitest tests with `npm run test -- <test-file>` for affected schemas,
  mappers, actions, and calculations; `npm run test` runs the full suite.
- Use `npm run e2e -- <spec-file>` for affected browser flows. Playwright configuration
  starts/reuses port 3000 and selects Chrome; inspect the spec's backend/account
  requirements before running it.
- Documentation-only changes require reference and diff checks, not lint/build/tests.
