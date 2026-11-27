# Mop Boss website

Marketing site and quote-request API for **Mop Boss** (Linda Tucker, Expert Housekeeper).

| Folder | What it is |
| --- | --- |
| `mopboss.client/` | The website: Next.js 16 (App Router), TypeScript, CSS Modules, statically prerendered |
| `MopBoss.Server/` | ASP.NET Core 10 API: receives quote requests, stores them in SQL Server, emails Linda |
| `MopBoss.Server.Tests/` | xUnit tests for the API |
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

All four of `lint`, `typecheck`, `test` and `build` must pass before every commit; CI runs them too.

### Settings

Copy `.env.example` to `.env.local` for local overrides. All three are read at build time.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | The live address, used for canonical URLs, `sitemap.xml`, `robots.txt` and social previews. Falls back to `http://localhost:3000`. |
| `NEXT_PUBLIC_QUOTE_API_URL` | Base URL of `MopBoss.Server`. **When empty, the quote form uses a mock that sends nothing** and the confirmation screen says "Demo only · nothing was sent". Never deploy publicly without it. |
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

`POST /api/quote` validates the request (same rules as the form), stores it in SQL Server, then emails Linda over SMTP. If the email fails, the request is still stored, with the error recorded on the row. Honeypot submissions are dropped silently. Each IP is limited to 5 requests per 10 minutes. CORS allows only the origins in `Site:AllowedOrigins`.

### Run locally

```bash
dotnet run --project MopBoss.Server     # http://localhost:5096
dotnet test MopBoss.Server.Tests
```

Development uses SQL Server LocalDB (`appsettings.Development.json`) and allows `http://localhost:3000`. To try the whole flow locally, set `NEXT_PUBLIC_QUOTE_API_URL=http://localhost:5096` for the website.

### Database migrations (applied manually)

The migration lives in `MopBoss.Server/Data/Migrations`. It is **not** applied automatically. Apply it yourself, for example:

```bash
dotnet ef database update --project MopBoss.Server
```

or generate a script to review and run:

```bash
dotnet ef migrations script --project MopBoss.Server --idempotent -o quote-requests.sql
```

### Email settings

Put SMTP credentials in user secrets locally and in environment variables in production, never in `appsettings.json`:

```bash
dotnet user-secrets init --project MopBoss.Server
dotnet user-secrets set "Smtp:Host" "smtp.yourprovider.com" --project MopBoss.Server
dotnet user-secrets set "Smtp:Username" "..." --project MopBoss.Server
dotnet user-secrets set "Smtp:Password" "..." --project MopBoss.Server
dotnet user-secrets set "Smtp:From" "Mop Boss website <quotes@yourdomain>" --project MopBoss.Server
dotnet user-secrets set "Smtp:To" "linda@yourdomain" --project MopBoss.Server
```

In production the same settings are environment variables (`Smtp__Host`, `Smtp__Password`, …), plus `ConnectionStrings__MopBoss` and `Site__AllowedOrigins__0`. Without SMTP settings the API stores requests and only logs that no email was sent.

Behind a reverse proxy, enable forwarded headers so the rate limit sees each visitor's IP rather than the proxy's.

## Still to decide

- Hosting for the website and the API, the domain and DNS (including SPF/DKIM for the sending address).
- The SMTP provider and the address Linda receives requests at.
- Everything in `CONTENT_NEEDED.md`.
