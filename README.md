# Mop Boss website

Marketing site and quote-request API for **Mop Boss** (Linda Tucker, Expert Housekeeper).

| Folder | What it is |
| --- | --- |
| `mopboss.client/` | The website: Next.js 16 (App Router), TypeScript, CSS Modules, statically prerendered |
| `MopBoss.Server/` | ASP.NET Core 10 API: validates quote requests, stores them in SQL Server (MB-Dev / MB-Prod) with a notification outbox, and a background worker emails Linda |
| `MopBoss.Server.Tests/` | xUnit tests: API, outbox, SMTP capture, and SQL Server in a disposable container |
| `database/` | Reviewed idempotent migration script, guarded migration runner and preflight, least-privilege template, read-only and recovery operator SQL |
| `PRODUCTION_READINESS.md` | Launch blockers, configuration, migrations, recovery, monitoring, privacy checklist |
| `docs/PHASE3_AUDIT.md` | What the Phase 2 implementation contained before hardening |
| `design-reference/` | The approved Phase 1 design (prototype, handoff notes, brand artwork). Reference only, not built or linted |
| `CONTENT_NEEDED.md` | Plain checklist of everything still waiting on Linda (generated) |

## Website (`mopboss.client`)

Requires Node 22 or later.

```bash
cd mopboss.client
npm ci
npm run dev          # http://localhost:3000 (demo quote form, from .env.development)
```

| Script | Does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run dev:audit` | Development server in content-audit mode (gold placeholder chips) |
| `npm run build` / `npm start` | Build and server. `build` refuses to run unless the deployment is stated (see Settings) |
| `npm run build:audit` | Production build in content-audit mode, for reviewing with Linda |
| `npm run lint` | ESLint (Next.js rules + Prettier compatibility) |
| `npm run typecheck` | Route type generation + `tsc --noEmit` (strict) |
| `npm test` | Vitest + Testing Library |
| `npm run format` / `format:check` | Prettier |
| `npm run content:needed` | Regenerate `CONTENT_NEEDED.md` from the content module |
| `npm run build:e2e` / `test:e2e` | Preview build with a loopback fake API, then Playwright in Chromium, Firefox and WebKit |
| `npm run check:build-guard` | Proves `next build` refuses omitted, misspelt and unsafe deployment settings |

All four of `lint`, `typecheck`, `test` and `build` must pass before every commit; CI runs them too.

### Settings

All are read at build time and inlined. **Every `next build` must state its deployment**:
a missing, misspelt or unsafe value stops the build (`src/lib/deployGuard.ts`), and if a
build somehow ships without valid settings the form fails closed to "online requests
unavailable, please call", never to the demo. `npm run dev` uses the committed
`.env.development` (development + demo); put local overrides in `.env.development.local`.
`.env.example` shows a production configuration.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_DEPLOY_ENV` | **Required**: `development`, `preview` or `production`. |
| `NEXT_PUBLIC_QUOTE_MODE` | `live` (default) or `demo`. Demo sends nothing and the confirmation says Linda has not received it. Only allowed outside production, and never together with an API URL. |
| `NEXT_PUBLIC_QUOTE_API_URL` | Base URL of `MopBoss.Server`, required for `live`. Production: https and not a local address. Preview: https, or http only for a loopback test API. Never credentials in the URL. |
| `NEXT_PUBLIC_SITE_URL` | The live address, used for canonical URLs, `sitemap.xml`, `robots.txt` and social previews. Required in production (https, not local). Falls back to `http://localhost:3000` elsewhere. |
| `NEXT_PUBLIC_CONTENT_AUDIT` | `1` shows the prototype's gold placeholder chips wherever content is missing. Refused in production. |

### Content: nothing invented

Every word and business fact lives in `src/content/`:

- `facts.ts`: the three confirmed facts (name, owner, phone) and every **unconfirmed** fact as a `null` field with a comment saying what is needed.
- `services.ts`: the five service categories (draft, awaiting Linda's approval). The homepage, services page and quote form all read from it.
- `quote.ts`: quote-form options and wording.
- `pages.ts`, `seo.ts`: page copy and metadata.
- `needed.ts`: the checklist behind `CONTENT_NEEDED.md`.

A `null` field renders nothing in a normal build, and a section with nothing left to show is omitted. To publish a fact, replace `null` with the value Linda confirmed, then run `npm run content:needed` so the checklist ticks it off. Structured data (JSON-LD) picks up address, hours, service area, email and price range automatically once they are filled. It never includes a rating.

### Where things are

- `src/app/`: routes (`/`, `/services`, `/about`, `/gallery`, `/quote`), metadata, sitemap, robots, icons, Open Graph image.
- `src/styles/tokens.css`: design tokens (colour, type, spacing, radii, shadows, easings) named after the handoff.
- `src/components/ui/`: Boss and ghost buttons, the Magnetic wrapper (the Boss Treatment), medallion, sparkle, bubble, sticker card, eyebrow, headings, spin ring, mop fringe.
- `src/components/layout/`: header, footers, mobile thumb bar, scroll-reveal observer.
- `src/components/reveal/`: the Transformation Reveal slider.
- `src/components/quote/` + `src/lib/quote/`: the quote flow, its state machine and the `submitQuoteRequest()` adapter.

The homepage switches to the Mobile-Home composition below 768px. Every animation has a `prefers-reduced-motion` path, and pages stay readable with JavaScript off. The quote form needs JavaScript and says so, offering the phone number instead.

## API (`MopBoss.Server`)

`POST /api/quote` (with an `Idempotency-Key` header) validates the request, stores it and a notification outbox row in **one transaction**, and answers `202` with a customer reference such as `MB-7K3Q9X`. A background worker emails Linda with bounded retries. Retrying with the same key returns the same reference. There are no endpoints to read requests or change their status.

Environments are strict: **Development uses MB-Dev only, Production uses MB-Prod only**, and anything else may use neither. A missing or mis-targeted connection string stops the API at startup; there is no fallback. Development credentials live in .NET user secrets, production ones in environment variables or a secret manager.

```bash
dotnet user-secrets set "ConnectionStrings:MopBoss" "<MB-Dev connection string>" --project MopBoss.Server
dotnet run --project MopBoss.Server --launch-profile http     # http://localhost:5096
dotnet test MopBoss.Server.Tests                               # Docker needed for the SQL Server tests
```

Migrations are **never applied automatically**, and `/health/ready` stays `Unhealthy` until the database has exactly the migrations the build expects. Review `database/MopBoss.migrations.idempotent.sql`, then follow the approval steps in [PRODUCTION_READINESS.md §6](PRODUCTION_READINESS.md#6-database-migrations-reviewed-never-automatic). Migration tooling refuses to connect unless the operator names the target: `database/Invoke-MopBossMigration.ps1 -Target Development -Database MB-Dev ...` (sqlcmd with a server-side preflight), or `dotnet ef` with `MOPBOSS_MIGRATION_TARGET` set (and `MOPBOSS_MIGRATION_AUTHORIZE_PRODUCTION=MB-Prod` for production). These guards catch mistakes; separate per-database migration identities are still what keeps MB-Dev credentials out of MB-Prod.

Email: without SMTP settings, development only logs, and those rows are recorded as `Suppressed` (never `Sent`). A loopback capture service (smtp4dev, Mailpit) is allowed, and a real relay outside production requires `Smtp:DevelopmentRecipientOverride` (a separate test inbox), so development can never email Linda or a customer. Production requires SMTP with TLS and the notification worker. Requests that could not be emailed keep `/health/ready` degraded and are logged as "ACTION NEEDED" at start-up and every hour until resolved. See [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md) for every setting, the outbox and retry behaviour, operator SQL (`database/operations-readonly.sql`, `database/operations-recovery.sql`), monitoring (`/health/live`, `/health/ready`) and the privacy checklist.

## Visual Studio (F5)

Open `MopBoss.slnx` in Visual Studio 2022 17.11+ or 2026 with the **ASP.NET and web development** and **Node.js development** workloads.

1. In the toolbar's startup dropdown (next to the green Play button) choose **Mop Boss (site + API)**. This shared profile lives in `MopBoss.slnLaunch`.
2. Press F5. Visual Studio starts `MopBoss.Server` with its `https` profile (`https://localhost:7019`, no browser) and runs `npm run dev` for `mopboss.client`, then opens `http://localhost:3000` in Edge with the JavaScript debugger attached. The test project is not started.

The browser comes from `mopboss.client/.vscode/launch.json` (`localhost (Edge)` or `localhost (Chrome)`). Without that file Visual Studio reports "The startup project cannot be launched". The site's form stays in demo mode unless `mopboss.client/.env.development.local` sets `NEXT_PUBLIC_QUOTE_MODE=live` and `NEXT_PUBLIC_QUOTE_API_URL=https://localhost:7019`.

## Still to decide

See the launch blockers at the top of [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md): hosting, domain and TLS, MB-Prod identities and backups, SMTP provider and Linda's address, monitoring, privacy decisions, and everything in `CONTENT_NEEDED.md`.
