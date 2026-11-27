# Mop Boss website

Marketing site and quote-request API for **Mop Boss** (Linda Tucker, Expert Housekeeper).

| Folder | What it is |
| --- | --- |
| `mopboss.client/` | The website: Next.js 16 (App Router), TypeScript, CSS Modules, statically prerendered |
| `MopBoss.Server/` | ASP.NET Core 10 API: validates quote requests, stores them in SQL Server (MB-Dev / MB-Prod) with a notification outbox, and a background worker emails Linda |
| `MopBoss.Server.Tests/` | xUnit tests: API, outbox, SMTP capture, and SQL Server in a disposable container |
| `database/` | Reviewed idempotent migration script, least-privilege and operator SQL templates |
| `PRODUCTION_READINESS.md` | Launch blockers, configuration, migrations, recovery, monitoring, privacy checklist |
| `docs/PHASE3_AUDIT.md` | What the Phase 2 implementation contained before hardening |
| `design-reference/` | The approved Phase 1 design (prototype, handoff notes, brand artwork). Reference only, not built or linted |
| `CONTENT_NEEDED.md` | Plain checklist of everything still waiting on Linda (generated) |

## Website (`mopboss.client`)

Requires Node 22 or later.

```bash
cd mopboss.client
npm ci
npm run dev          # http://localhost:3000
```

| Script | Does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run dev:audit` | Development server in content-audit mode (gold placeholder chips) |
| `npm run build` / `npm start` | Production build and server |
| `npm run build:audit` | Production build in content-audit mode, for reviewing with Linda |
| `npm run lint` | ESLint (Next.js rules + Prettier compatibility) |
| `npm run typecheck` | Route type generation + `tsc --noEmit` (strict) |
| `npm test` | Vitest + Testing Library |
| `npm run format` / `format:check` | Prettier |
| `npm run content:needed` | Regenerate `CONTENT_NEEDED.md` from the content module |
| `npm run build:e2e` / `test:e2e` | Production build with a fake API address, then Playwright in Chromium, Firefox and WebKit |

All four of `lint`, `typecheck`, `test` and `build` must pass before every commit; CI runs them too.

### Settings

Copy `.env.example` to `.env.local` for local overrides. All are read at build time.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_DEPLOY_ENV` | `development` (default), `preview` or `production`. **A production build refuses to build** unless the API and site URLs are https and audit mode is off. |
| `NEXT_PUBLIC_SITE_URL` | The live address, used for canonical URLs, `sitemap.xml`, `robots.txt` and social previews. Falls back to `http://localhost:3000`. |
| `NEXT_PUBLIC_QUOTE_API_URL` | Base URL of `MopBoss.Server`. When empty outside production the form runs in **demo mode**: nothing is sent, and the confirmation says Linda has not received it. In production an empty value means "online requests unavailable, please call". |
| `NEXT_PUBLIC_CONTENT_AUDIT` | `1` shows the prototype's gold placeholder chips wherever content is missing. Never set it for the public site. |

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

Migrations are **never applied automatically**. Review `database/MopBoss.migrations.idempotent.sql`, then follow the approval steps in [PRODUCTION_READINESS.md §6](PRODUCTION_READINESS.md#6-database-migrations-reviewed-never-automatic). `dotnet ef` uses a design-time factory and the `MOPBOSS_MIGRATIONS_CONNECTION` variable (migration identity), never the app's runtime settings.

Email: without SMTP settings, development only logs. A loopback capture service (smtp4dev, Mailpit) is allowed, and a real relay outside production requires `Smtp:DevelopmentRecipientOverride`, so development can never email Linda. Production requires SMTP with TLS. See [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md) for every setting, the outbox and retry behaviour, recovery queries (`database/operations.sql`), monitoring (`/health/live`, `/health/ready`) and the privacy checklist.

## Still to decide

See the launch blockers at the top of [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md): hosting, domain and TLS, MB-Prod identities and backups, SMTP provider and Linda's address, monitoring, privacy decisions, and everything in `CONTENT_NEEDED.md`.
