# Production readiness: Mop Boss

Status at the end of Phase 3 hardening (branch `hardening/phase-3`). What `main` looked like
before this work is recorded in [`docs/PHASE3_AUDIT.md`](docs/PHASE3_AUDIT.md).

**Verdict: not ready to launch.** The code is in a launchable state, but the launch blockers
below need decisions, accounts, credentials or content that only the owner can provide.
None of them can be closed in code.

---

## 1. Launch blockers (mandatory)

| # | Blocker | Owner action |
| --- | --- | --- |
| 1 | **Hosting** for the website (Node 22, `next start`) and the API (.NET 10) is not chosen | Choose a host for both; see §9 |
| 2 | **Domain, DNS and TLS certificates** | Register/point the domain; HTTPS for both site and API |
| 3 | **MB-Prod connection** for the API: server, runtime identity, encrypted connection | Create identities with `database/least-privilege.sql`; inject `ConnectionStrings__MopBoss` as a secret |
| 4 | **Migrations not applied** to MB-Dev or MB-Prod | Follow §6, with explicit approval for each database |
| 5 | **SMTP provider and Linda's notification address** | Choose a provider; set SPF/DKIM/DMARC for the sending domain; inject `Smtp__*` secrets |
| 6 | **Backups for MB-Prod** with a tested restore | §10 |
| 7 | **Monitoring/alerting** on `/health/ready` and on notification failures | §11 |
| 8 | **Privacy decisions**: retention period, privacy note on the form, privacy policy (legal advice) | §13. A privacy policy has not been written and must not be invented |
| 9 | **Content**: the 28 items in [`CONTENT_NEEDED.md`](CONTENT_NEEDED.md), including the form's privacy note | Linda |
| 10 | **Copy approval**: new confirmation and error wording (marked "NEW COPY" in `src/content/quote.ts`) plus draft marketing copy | Linda |
| 11 | **Manual verification** on real devices and assistive technology (§15) | Owner / tester |
| 12 | **End-to-end check on MB-Dev**: a real request through the deployed API reaches a test inbox | After 3–5, before production |

## 2. Architecture

```
Browser ──HTTPS──▶ Website (Next.js 16, prerendered pages, `next start`)
   │                  sets CSP and security headers; no cookies, no analytics
   │
   └──HTTPS POST /api/quote (Idempotency-Key) ──▶ MopBoss.Server (ASP.NET Core 10)
                                                    │ validate → one transaction:
                                                    │   QuoteRequests + NotificationOutbox
                                                    │ 202 + reference (MB-XXXXXX)
                                                    ▼
                                              SQL Server (MB-Dev / MB-Prod)
                                                    ▲
                     NotificationWorker (BackgroundService, same process)
                        claims due outbox rows (lease + concurrency token)
                        ──SMTP (TLS)──▶ provider ──▶ Linda's inbox
```

- The API answers **202 only after the quote and its outbox row are committed together**.
  It never claims the email was sent. The website shows the reference and says the request
  is saved.
- There are no public endpoints to read requests or change their status. Status changes are
  operator SQL (`database/operations.sql`, query F).

## 3. Environments and databases

| Environment | Database | Email | How it is enforced |
| --- | --- | --- | --- |
| Development | **MB-Dev** only | Logging only, or a loopback capture service (smtp4dev, Mailpit), or a real relay **only** with `Smtp:DevelopmentRecipientOverride` (a test inbox); subjects get `[TEST]` | Startup refuses any other database or an unsafe SMTP target |
| Production | **MB-Prod** only | Configured provider to Linda's approved address, StartTls or SslOnConnect | Startup refuses MB-Dev, missing SMTP, plain-text SMTP, unencrypted DB connections or `TrustServerCertificate=True` |
| Testing (automated) | Disposable `MopBossTest_*` databases in a SQL Server container | In-process fake SMTP server | Startup refuses MB-Dev/MB-Prod for any other environment; the test fixture refuses any database not named `MopBossTest_*` |

- There is **no fallback connection string**. A missing value stops the API at startup with
  a message naming the setting, never its contents.
- At startup the API logs the environment and **database name only** (never server or
  credentials), e.g. `Environment Production uses database MB-Prod`.
- CI has no database credentials and cannot reach either database.

## 4. Configuration reference

### API (`MopBoss.Server`): environment variables in production, user secrets in development

| Setting | Required | Notes |
| --- | --- | --- |
| `ConnectionStrings__MopBoss` | Always | Runtime identity. Production needs `Encrypt=True` (or `Strict`) and `TrustServerCertificate=False` |
| `Site__AllowedOrigins__0` | Production | The website's `https://` origin, used for CORS |
| `Smtp__Host`, `Smtp__Port`, `Smtp__Security` | Production | `Security`: `StartTls` (default) or `SslOnConnect` |
| `Smtp__Username`, `Smtp__Password` | Provider-dependent | Secret |
| `Smtp__From`, `Smtp__To` | Production | `To` is Linda's approved address |
| `Smtp__DevelopmentRecipientOverride` | Non-production with a real relay | Must be empty in Production |
| `ReverseProxy__KnownProxies__0` / `ReverseProxy__KnownNetworks__0` | When behind a proxy | Without these, forwarded headers are ignored, and behind a proxy every visitor shares one rate-limit bucket |
| `Notifications__*` | Optional | Defaults: poll 10 s, batch 10, 8 attempts, 30 s base delay, 1 h cap, 120 s lease |
| `AllowedHosts` | Recommended | Set to the API host name (default `*`) |
| `MOPBOSS_MIGRATIONS_CONNECTION` | Only when applying migrations | Migration identity, set in the operator's shell only; never stored |

### Website (`mopboss.client`): build-time variables

| Variable | Production value |
| --- | --- |
| `NEXT_PUBLIC_DEPLOY_ENV` | `production`. The build then **refuses** to run unless the two URLs below are https and audit mode is off |
| `NEXT_PUBLIC_QUOTE_API_URL` | The API's https origin. If it is missing in production, the form tells visitors to phone Linda and never pretends to send |
| `NEXT_PUBLIC_SITE_URL` | The site's https origin (canonical URLs, sitemap, Open Graph) |
| `NEXT_PUBLIC_CONTENT_AUDIT` | Unset or `0` |

## 5. Local development

```bash
# API (needs access to MB-Dev; credentials stay in user secrets)
dotnet user-secrets set "ConnectionStrings:MopBoss" "<MB-Dev connection string>" --project MopBoss.Server
dotnet run --project MopBoss.Server --launch-profile http        # http://localhost:5096

# Optional local email capture instead of the logging notifier:
#   run smtp4dev or Mailpit on localhost:25/1025, then
dotnet user-secrets set "Smtp:Host" "localhost" --project MopBoss.Server
dotnet user-secrets set "Smtp:Port" "1025" --project MopBoss.Server
dotnet user-secrets set "Smtp:Security" "None" --project MopBoss.Server
dotnet user-secrets set "Smtp:From" "quotes@example.test" --project MopBoss.Server
dotnet user-secrets set "Smtp:To" "linda@example.test" --project MopBoss.Server

# Website
cd mopboss.client && npm ci
NEXT_PUBLIC_QUOTE_API_URL=http://localhost:5096 npm run dev      # or leave unset for demo mode
```

Development will not start against MB-Dev until the migrations are applied there (§6).

## 6. Database migrations: reviewed, never automatic

The API never migrates at startup. Migrations live in `MopBoss.Server/Data/Migrations`; the
reviewable script is `database/MopBoss.migrations.idempotent.sql` (CI fails if it is stale).

1. **Review** the migration code and the generated script. The `QuoteLifecycleAndNotificationOutbox`
   migration is data-preserving: existing rows get legacy references (`MB-` + 9 hex digits)
   and status `New`, and any Phase 2 request that was never emailed is queued for delivery.
2. **Validate on an isolated database.** CI and `dotnet test` run the committed script twice
   on a fresh SQL Server 2022 container, and upgrade a Phase 2 schema containing legacy rows.
3. **Apply to MB-Dev** (with approval), using the migration identity:
   ```bash
   export MOPBOSS_MIGRATIONS_CONNECTION="<MB-Dev migration identity connection string>"
   dotnet ef migrations list --project MopBoss.Server        # read-only: what is applied
   dotnet ef database update --project MopBoss.Server
   ```
   or run `database/MopBoss.migrations.idempotent.sql` in SSMS / `sqlcmd`.
4. **Verify** on MB-Dev: the API starts, `/health/ready` is `Healthy`, and a test request
   reaches the test inbox.
5. **Back up MB-Prod** and confirm the backup restores (§10).
6. **Approve** the same reviewed script for production. Do not regenerate it.
7. **Apply to MB-Prod** with the production migration identity, then check:
   `SELECT MigrationId FROM __EFMigrationsHistory`, `/health/ready`, and one real request.

Never drop, truncate or reseed MB-Prod. `Down` migrations exist but discard lifecycle data;
treat them as an emergency tool requiring a fresh backup and explicit approval.

## 7. SMTP and email isolation

- Messages are **plain text only**, so nothing a customer types can become HTML or a link.
  Header values are flattened to one line; addresses go through MailKit's parser. The
  customer's email becomes `Reply-To`.
- Each notification has a stable `Message-ID` (`<quote-{id}@notifications.mopboss>`).
- Non-production subjects start with `[TEST]`, and non-production sends to a non-local relay
  go only to `DevelopmentRecipientOverride`.
- Sender-domain authentication (SPF, DKIM, DMARC) is provider- and DNS-specific and is a
  launch task.

## 8. Notification outbox and retries

| Field | Meaning |
| --- | --- |
| `Status` | `Pending`, `Sent` or `Failed` (terminal) |
| `Attempts`, `NextAttemptAtUtc` | Bounded exponential backoff: 30 s, 1 m, 2 m, 4 m, 8 m, 16 m, 32 m (±20% jitter, cap 1 h). The 8th failure, about 63 minutes after the first, marks it `Failed` |
| `LockToken`, `LockedUntilUtc` | A worker's lease (120 s); expired leases are picked up again, so the queue recovers after crashes and restarts |
| `ConcurrencyStamp` | Optimistic concurrency: two workers or instances cannot both claim a row |
| `SentAtUtc` | When the SMTP server accepted the message |
| `LastError` | Exception type and SMTP codes only, e.g. `SmtpCommand:RecipientNotAccepted:550`. Never message text, which can contain addresses |

- Relay rejections (5xx mailbox, sender or recipient refused) are **permanent** and fail
  immediately. Timeouts, connection, TLS and authentication problems are retried.
- On shutdown, an in-flight send releases its lease without counting the attempt.
- **Duplicates are possible and accepted.** SMTP has no exactly-once delivery. If the relay
  accepts a message and the process stops before recording `Sent`, the message is resent
  after the lease expires. Both copies share one `Message-ID`. The outbox, the unique
  `QuoteRequestId` index, idempotency keys and the 10-minute resubmit check prevent every
  other duplicate path.

## 9. Hosting requirements (provider-neutral)

- **Website:** Node.js 22 running `next start` (not a static export: security headers and
  image optimisation need the server). Roughly 300–400 KB per page; any small instance will do.
- **API:** .NET 10 runtime with outbound SMTP (587/465) and SQL Server (1433, encrypted). The
  notification worker runs inside the API, so keep **at least one instance always on**. Several
  instances are safe for the outbox; the rate limit is per instance, in memory.
- **TLS** for both, terminated at the host or a reverse proxy. Configure `ReverseProxy__*` with
  the proxy's addresses so client IPs and the rate limit work.
- **Secrets** in the host's secret store or environment, separate for CI, MB-Dev and MB-Prod.
  CI holds no deployment credentials.

## 10. Backup and restore (MB-Prod)

Required before the first production migration and ongoing:
- Automated full backups (daily at least) plus point-in-time or log backups if the platform
  offers them; retention to match the agreed data-retention period (§13).
- Encrypted backups, stored apart from the primary, with access limited to operators.
- A **tested restore** into a separate database before launch, and periodically afterwards.
- Backups contain customer contact data: never copy them to personal machines or into Git
  (`.gitignore` blocks `*.bak`, `*.bacpac`, `backups/`, `exports/`).

## 11. Monitoring

| Signal | Source | Alert when |
| --- | --- | --- |
| API up | `GET /health/live` → `Healthy` | Not 200 |
| Database and email queue | `GET /health/ready` → `Healthy` / `Degraded` / `Unhealthy` | `Unhealthy` (database down, HTTP 503), or `Degraded` (a notification failed permanently in the last 7 days, or one has been due for over 30 minutes) |
| Permanent failure | Log at Error: "Notification for quote {Reference} FAILED permanently…" | Any occurrence |
| Retries | Log at Warning: "…failed (attempt n of 8)…" | Sustained for over 30 minutes |
| Worker problems | Log at Error: "Notification worker cycle failed" | Repeated |

Health endpoints return only a status word. Logs contain references and counts, never names,
phone numbers or email addresses.

## 12. Operational recovery

Use an operator identity, never the runtime one. Queries are in `database/operations.sql`.

- **Some notifications failed** (A, B): find references and errors.
- **Cause fixed, e.g. SMTP credentials or provider outage** (C or D): requeue. Linda may receive
  a second copy of any message that actually got through earlier.
- **Cannot email at all**: read the request (E), pass it to Linda by a secure route, then mark
  it `HandledManually`. It stays `Failed` and stops degrading health.
- **Status changes** (F): New → Contacted → Quoted → Scheduled → Completed, or Cancelled.

## 13. Privacy and data handling

**Collected** through the quote form: name; phone and/or email; optional ZIP and free-text
notes (which may contain anything a customer chooses to write, e.g. access details); service,
property type, size and frequency. Also a honeypot field (bots only) and the browser's clock
(not stored). The visitor's IP address is used **in memory** for rate limiting and is not
stored by the application; hosting and proxy logs may still record it.

**Not collected:** no cookies, no local storage, no analytics or third-party scripts, fonts
self-hosted (verified in code).

**Stored:** `QuoteRequests` in MB-Prod (all form fields, reference, status, timestamps,
a SHA-256 of the request used for de-duplication) and `NotificationOutbox` (delivery
metadata only). Copies also exist in **Linda's inbox** and in the **SMTP provider's** logs,
and in **database backups**.

**Transmitted:** browser to API over HTTPS (the production build guard requires an https API
URL; HSTS on both); API to SQL Server encrypted (required in production); API to SMTP over TLS
(required in production).

**Decisions needed from the owner, with legal advice where appropriate:**
- [ ] Retention period for quote requests (e.g. delete Completed/Cancelled after N months) and
      who carries out deletion (the runtime identity deliberately cannot delete).
- [ ] How long Linda keeps request emails, and the SMTP provider's log retention.
- [ ] Backup retention consistent with the above.
- [ ] How a customer's request to see or delete their data is handled, and by whom.
- [ ] The one-line privacy note on the form (`CONTENT_NEEDED.md`).
- [ ] Whether a privacy policy is required for this business and location. Not written here.
- [ ] Who may access MB-Prod and Linda's mailbox; use separate accounts, with MFA where available.

## 14. Security summary

Covered and tested: strict per-environment configuration; no fallback databases; encrypted
DB and SMTP in production; least-privilege runtime identity template; server-side validation
mirroring the form, with choices limited to the shared option list; unknown JSON properties
rejected; control characters rejected in contact fields; 16 KB request limit on the quote
endpoint (64 KB global); per-IP rate limit (5 per 10 minutes) with forwarded headers trusted
only from configured proxies; honeypot; idempotency keys; parameterised EF Core queries only;
plain-text email; CORS allow-list (not access control: anyone can POST directly, which is why
the other controls exist); security headers and CSP on the site and API; ProblemDetails
errors without stack traces; OpenAPI only in Development; no read or administration
endpoints; no secrets in Git; `npm audit` and `dotnet list package --vulnerable` clean at
the time of writing, with CI checks and Dependabot to keep them so.

Known limitations, accepted for now:
- The site's CSP allows `'unsafe-inline'` for scripts and styles. Nonces would force dynamic
  rendering. No user content is rendered as HTML.
- The honeypot and rate limit stop casual abuse only. There is no CAPTCHA; add one only if
  spam appears.
- The rate limit is in memory, per instance, and resets on restart.
- `/health/*` is public but reveals only a status word. Restrict it at the proxy if preferred.
- The 413 response for oversized bodies comes from Kestrel and is not covered by the
  in-process tests.

## 15. Manual verification checklist

- [ ] iPhone Safari and Android Chrome: home hero, thumb bar, service rail swipe, slider drag
      (touch), quote flow end to end, keyboard opening and closing over the form.
- [ ] Screen readers: NVDA + Firefox/Chrome on Windows, VoiceOver on iOS and macOS. Step
      headings get focus, hints and failures are announced, the slider value is read.
- [ ] Keyboard-only pass in Safari with "Press Tab to highlight each item" enabled.
- [ ] Real email from the chosen provider lands in Linda's inbox (not spam), with `[TEST]`
      absent in production and Reply-To working.
- [ ] Migrations on MB-Dev, then the request → database → email loop on the deployed API.
- [ ] Restore test of an MB-Prod backup.
- [ ] Lighthouse on the deployed production URL (mobile), compared with the local numbers below.

## 16. Testing

```bash
# Website
cd mopboss.client
npm run lint && npm run typecheck && npm test && npm run build
npm run build:e2e && npm run test:e2e          # Playwright: Chromium, Firefox, WebKit

# API (Docker needed for the SQL Server tests)
dotnet test MopBoss.Server.Tests
dotnet test MopBoss.Server.Tests --filter "Category!=SqlServer"   # without Docker
dotnet format MopBoss.Server/MopBoss.Server.csproj --verify-no-changes
```

Local results at the end of Phase 3: Vitest 78 passed; .NET 67 passed (including 7 against
SQL Server 2022 in a container); Playwright 47 passed and 4 intentionally skipped across
three engines; Lighthouse mobile on a local production build: 100 / 100 / 100 / 100 on `/`
and `/quote`. Playwright's WebKit is not iPhone Safari.

## 17. Requirement status after Phase 3

| Requirement | Status |
| --- | --- |
| Durable record, unique reference, UTC created/updated, constraints and indexes | Done, verified on SQL Server |
| Validation incl. allowed values, lengths, optional fields | Done, tested |
| Idempotency and duplicate protection, incl. concurrent duplicates | Done, verified on SQL Server |
| Lifecycle New → Cancelled, no public status endpoint | Done (operator SQL) |
| Transactional outbox, worker, retries, terminal failures, restart recovery, concurrency, shutdown | Done, tested (in-memory and SQL Server, end to end with SMTP) |
| Truthful demo, live, validation, rate-limit, network, server, uncertain and missing-config states | Done, unit and browser tested |
| Production cannot fall back to the demo | Done (build guard and runtime "unavailable") |
| Environment isolation MB-Dev / MB-Prod, no fallback, startup validation | Done, tested |
| Least-privilege identities, separate migration identity | Template and design-time factory; **identities not created** (blocker 3) |
| Security headers, CSP, request limits, forwarded headers, logging without PII | Done, tested where observable |
| Relational tests, SMTP capture tests, browser tests | Done |
| CI: format, lint, types, tests, builds, migrations, vulnerabilities | Done; **first run happens when the branch is pushed** |
| Backups, monitoring, hosting, DNS, SMTP provider, privacy decisions | **External, not done** |

## 18. Optional future improvements

- Small authenticated admin view for statuses (deliberately out of scope).
- Nonce-based CSP if pages ever move to dynamic rendering.
- Distributed rate limiting if the API runs on several instances under real abuse.
- CAPTCHA (privacy-friendly) if spam gets past the honeypot.
- Retention job (scheduled deletion) once the retention period is decided.
- SMS or push alert to Linda alongside email.
