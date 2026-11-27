# Phase 3 audit: state of `main` at 62130bf (2026-11-27)

This records what the Phase 2 implementation actually contained before hardening began,
checked against the code rather than the Phase 2 report. Status of each item after the
hardening work is tracked in [`PRODUCTION_READINESS.md`](../PRODUCTION_READINESS.md).

Legend: **OK** implemented and verified · **WEAK** implemented but insufficient ·
**MISSING** · **EXT** requires external configuration · **MANUAL** requires manual verification

## CI

| Item | Status | Evidence |
| --- | --- | --- |
| GitHub Actions on `main` | OK | Run 46027728800 for 62130bf: website job (format, lint, typecheck, test, build) and API job (build, test) both succeeded |
| .NET formatting check | MISSING | CI builds and tests the API but never checks C# formatting |
| Dependency vulnerability scanning | MISSING | No `npm audit`, no `dotnet list package --vulnerable`, no Dependabot |
| Relational and browser tests in CI | MISSING | Only Vitest (jsdom) and EF Core in-memory tests exist |

## Quote persistence (`MopBoss.Server`)

| Requirement | Status | Finding |
| --- | --- | --- |
| Durable SQL Server record | WEAK | `QuoteRequests` table and migration exist; the migration has never been applied anywhere |
| Customer-facing reference | MISSING | The API returns the first 8 hex characters of the GUID; it is not stored, not unique-indexed, and not shown to the customer |
| UTC created / modified timestamps | WEAK | `ReceivedAt` only; no modification timestamp |
| Constraints and indexes | WEAK | Max lengths and a `ReceivedAt` index; no check constraints, no unique keys |
| Server-side validation | WEAK | Field rules mirror the form, but service, property, size and frequency accept any string up to 100 characters ("invalid enum values" are accepted) |
| Idempotency / duplicate protection | MISSING | A retried or double-sent request creates a second row and a second email |
| Lifecycle status (New … Cancelled) | MISSING | No status column |

## Email notification

| Requirement | Status | Finding |
| --- | --- | --- |
| Durable delivery with retry | MISSING (critical) | The email is sent inside the HTTP request. If SMTP fails, the error is stored on the row and the request is never retried, so Linda silently misses it |
| Safe error summaries | WEAK | `NotificationError` stores the raw exception message, which for SMTP rejections can contain email addresses |
| Environment isolation | WEAK | Without SMTP settings the API only logs; with settings, any environment, including development, could email the real recipient |
| Header / HTML injection | OK | Plain-text body, one-line subject, MailKit address parsing (unit tested) |

## Quote wizard (`mopboss.client`)

| Requirement | Status | Finding |
| --- | --- | --- |
| Demo honesty | WEAK (bug) | The confirmation always says "Linda has your details and will follow up", even in demo mode where nothing was sent; only the stamp contradicts it |
| Real confirmation shows reference | MISSING | The reference returned by the API is discarded |
| Error states | WEAK | One generic "Something went wrong" message for validation, rate limiting, network, server and timeout failures; no timeout at all |
| Double submission | OK | The reducer ignores Continue while submitting |
| Idempotency key on retry | MISSING | |
| Production cannot fall back to demo | MISSING | A production build without `NEXT_PUBLIC_QUOTE_API_URL` silently ships the mock |

## Security

| Area | Status | Finding |
| --- | --- | --- |
| CORS | OK, limited | Allow-list of origins, POST only. CORS does not stop direct requests (curl, bots); the rate limit and honeypot are the real controls |
| Request size limit | MISSING | Kestrel default (about 30 MB) applies to `POST /api/quote` |
| Rate limiting behind a proxy | WEAK | Partitions by `RemoteIpAddress`; behind a reverse proxy every visitor shares the proxy's bucket. Forwarded headers are not configured (correctly not trusted, but not handled either) |
| Honeypot | OK, limited | Stops naive bots only; documented as such |
| SQL injection | OK | EF Core parameterised queries only; no raw SQL |
| XSS | OK | React escaping; JSON-LD escapes `<`; no `dangerouslySetInnerHTML` with user data |
| Security headers / CSP | MISSING | Neither the website nor the API sets CSP, `X-Content-Type-Options`, `Referrer-Policy`, frame protections or HSTS |
| Exception handling | WEAK | Framework defaults; no ProblemDetails exception handler |
| Startup configuration validation | MISSING | An empty connection string fails at first request, not at startup; nothing stops the wrong database being targeted |
| Development endpoints | OK | OpenAPI is mapped only in Development |
| Health checks | MISSING | |
| Secrets in Git | OK, but | No secrets committed. `appsettings.Development.json` holds a LocalDB connection string that the MB-Dev / MB-Prod decision supersedes |
| Ignore rules | WEAK | No rules for database files, backups, local settings or exported customer data |

## Tests

| Area | Status | Finding |
| --- | --- | --- |
| Quote state machine, adapter, UI | OK | 52 Vitest tests |
| API behaviour | WEAK | 14 tests on EF Core in-memory, which ignores constraints, transactions and SQL Server concurrency |
| SMTP | WEAK | Message construction is unit-tested; MailKit has never talked to an SMTP server |
| Browsers | MISSING | No automated browser tests; manual checks used Chromium only |

## Documentation

| Item | Status | Finding |
| --- | --- | --- |
| README | WEAK | Accurate for Phase 2 but describes LocalDB and synchronous email |
| Production readiness, privacy, recovery | MISSING | |

## External configuration (cannot be done in code)

MB-Dev and MB-Prod connection details and identities, SMTP provider and Linda's
notification address, hosting for both apps, reverse-proxy addresses, domain, TLS,
backups and monitoring. MB-Dev and MB-Prod are not on this machine's SQL Server
instance and no credentials were provided, so neither database was inspected.

## Manual verification needed

Real iPhone Safari and Android Chrome, screen readers (NVDA, VoiceOver), email
deliverability from the chosen provider, and applying the migration to MB-Dev.
