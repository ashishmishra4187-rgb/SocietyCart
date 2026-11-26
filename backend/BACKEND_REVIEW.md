# SocietyCart backend: review, fixes and how to run

## Rating

| | As received | After these changes |
|---|---|---|
| **Overall** | **5 / 10** | **8.5 / 10** (not yet run end-to-end, see "What I could and could not verify") |

**As received, strengths:** clean package layout, Flyway migrations, record DTOs, a clear pricing engine with tests (13 tests passed on your machine), scheduler for cut-offs, WebSocket broadcasting, Bean Validation on inputs.

**As received, problems (why 5/10):**

| # | Problem | Impact |
|---|---|---|
| 1 | Everything `permitAll`, CSRF off, CORS `*` + credentials, no login/OTP/resident model | Anyone anonymous could create societies, pools, orders and close pools. The frontend's sign-in could never work (the 404 you saw). |
| 2 | Order identity (name/email/phone) trusted from the request body | Anyone could order as anyone. |
| 3 | `placeOrder` had no lock; `@Version` conflicts surfaced as 500s | Two neighbours joining at once = lost update or an error. The tier price could be wrong. |
| 4 | WebSocket broadcast sent **before** the transaction committed | Clients refetch stale data, or are told about a rolled-back change. |
| 5 | Progress loaded every order just to count them; tiers N+1 | Slow list/detail endpoints as pools grow. |
| 6 | No `@RestControllerAdvice` | `NoSuchElement`/`IllegalState` became opaque 500s; the UI could not show reasons. |
| 7 | Below the first tier the engine still applied the first tier's discount | Wrong price at low volume (e.g. a tier starting at 10 units discounted 0 units). |
| 8 | Settlement could charge more than the price quoted at join (after cancellations) | Breaks the "pay less, never more" promise. |
| 9 | Purchase order packing slips included **cancelled** orders; PO numbers/order numbers from `Math.random` | Supplier would deliver to residents who cancelled; collisions possible. |
| 10 | `ddl-auto: update` alongside Flyway; DB password committed in `application.yml`; `baseline-on-migrate: true` | Two schema owners; secret in source control. |
| 11 | Closing a pool did settle + PO + dispatch in one step, no admin review | Mismatch with the admin dispatch screen; no undo window. |
| 12 | API shapes (field names, statuses, topic `/topic/pool/{id}`, endpoints) differed from the web app | Frontend could not work even with auth. |
| 13 | WebSocket frames would serialise `Instant` as numbers; SockJS+native duplicate endpoint; no heartbeats | Frontend would drop frames / silently disconnect behind proxies. |

## What changed

**Security**
- Sign in and **create account**, both proven by OTP: `/api/auth/otp` (existing accounts only), `/api/auth/signup` (name, society, flat, role; held aside and the account is created only after the OTP is verified), `/verify`, `/logout`. Society-admin sign-up needs an admin code (`societycart.auth.admin-signup-code`; empty = disabled, demo code refused under `prod`). Session in an **httpOnly, SameSite=Lax** cookie; session id rotated on login (fixation defence).
- OTP: only an HMAC of the code is held (never the code), 5-minute TTL, 30 s resend cool-down, 5 sends/hour/phone, 5 wrong guesses then locked, single use. Trade-off: sign-in tells an unknown number to create an account (needed for a usable sign-up flow), so account existence can be probed; the OTP rate limits bound abuse, and a CAPTCHA/WAF rule on `/api/auth/*` is the production answer.
- CSRF enabled (double-submit cookie, SPA pattern). CORS restricted to configured origins, no wildcard. WebSocket handshake requires a session and checks Origin.
- Roles: `RESIDENT`, `SOCIETY_ADMIN`, `PLATFORM_ADMIN`. Admin API is gated by URL rule **and** re-checked against the database in the service, scoped to the admin's own society. Residents only see their own society's pools (other societies look like 404).
- Orders take identity from the session only. Session role is not trusted for data decisions: the resident is re-read from the DB per request, so deactivation takes effect immediately.
- Secrets: no DB password default outside the `dev` profile. `fixed-otp` is refused at startup under `prod`. `LoggingOtpSender` (prints OTPs) does not exist under `prod`, so production fails to start until you supply a real `OtpSender`.

**Correctness / concurrency**
- Every state change takes `SELECT ... FOR UPDATE` on the pool row (join, cancel, close, dispatch, scheduler).
- Idempotent join (`Idempotency-Key`), one active order per resident per pool (service check **and** partial unique index), per-order max quantity.
- Broadcasts run **after commit**; failures never roll back the business operation.
- Lifecycle is now explicit: `OPEN -> LOCKED` (prices settled) `-> DISPATCHED` (PO sent) `-> COMPLETED` (delivered). The scheduler locks expired pools; a shopkeeper in the same society confirms dispatch after cutoff.
- Zero-order pools are cancelled instead of "settled".
- Engine: base price below the first tier; settlement capped at the quoted price; identity (not `equals`) for the current-tier flag; order-count overload (no more loading all orders); server-side tier planning with floor-price validation.
- PO excludes cancelled orders and uses unguessable numbers.

**Data**
- `V2__residents_auth_and_pool_controls.sql` (V1 untouched so existing Flyway checksums stay valid): `residents`, `pool_orders.resident_id/idempotency_key`, `pool_windows.floor_price/max_quantity_per_order/dispatched_at`, partial unique indexes. All statements are re-runnable.
- `ddl-auto: validate` (Flyway owns the schema), `baseline-on-migrate: false`. I cross-checked every entity field against the V1+V2 columns by script.

**API / frontend fit**: new endpoints and DTOs in the exact shape the web app uses (see the frontend README); one error format `{message}`; WebSocket on native `/ws` with the application's ObjectMapper (ISO dates), 10 s heartbeats, topic `/topic/pools/{id}`.

## Admin features (added after the first review)
- **Product catalog** (`/api/admin/products`, table `products`, migration V3): an admin adds a product once (name, SKU, usual price, unit, category, photo link) and opens deals by picking it. The deal's name/photo/unit come from the catalog, never from the request, so typos and duplicate spellings cannot creep in. SKUs are immutable; products can be archived/restored (archived products can't start new deals but stay on past ones). Photo links must be `http(s)://` (rejects `javascript:` etc.). V3 backfills the catalog from existing deals.
- **Change the closing time** of an open deal (`PATCH /api/admin/pools/{id}`): at least 5 minutes ahead, at most 30 days; row-locked; broadcast live. Extending is safe for residents because prices only improve with more joiners.
- **Cancel a deal** (`POST .../cancel`) while open or closed-but-not-dispatched: every active order is cancelled with it. Nobody is charged in this app yet, so there is nothing to refund.
- **Packing list** (`GET .../packing-list`): per flat, natural flat order (B-2 before B-10), cancelled orders excluded, unit price and amount, totals. The frontend can download it as CSV (formula-injection safe) or print it.

## Run it

```bash
# 1. Postgres running, database societycart_db exists
mvn spring-boot:run            # profile "dev" is the default
```

Dev conveniences (profile `dev` or `h2` only): OTP is always **123456** (also logged), admin sign-up code `SOCIETY-ADMIN-DEMO`, demo accounts admin **9000000001** / resident **9000000002**, and 3 fresh demo pools are opened if none are open (the pools in V1 expire 24 h after first start). Make your own number an admin either by creating an account as *Society admin* with the demo code, or `SOCIETYCART_DEV_ADMIN_PHONE=8829971079 mvn spring-boot:run`.

Existing database: Flyway applies V2 automatically on startup. Because `ddl-auto` is now `validate`, if you see a "missing column" error on startup, the message names the column; send it to me.

Production checklist: `SPRING_PROFILES_ACTIVE=prod`, `SPRING_DATASOURCE_*`, `SESSION_COOKIE_SECURE=true` (HTTPS), `SOCIETYCART_ALLOWED_ORIGINS=https://your-site`, and an `OtpSender` bean wired to your SMS/WhatsApp provider. **Rotate the old DB password**: it was in the zip you shared.

Make someone a society admin / platform admin: `UPDATE residents SET role = 'SOCIETY_ADMIN' WHERE phone = '...';`

## What I could and could not verify

I had **no access to Maven Central**, so I could not compile or start the Spring application, or run it against PostgreSQL. What I did verify:

- **Executed (29 tests, all pass)** by compiling the framework-free parts with `javac` against stubbed annotations and a small runner: `OtpService` (incl. a 20-thread guess-flood test), `PricingEngine` (your 5 original tests + 6 new), `ViewMapper`.
- **Compiler checks:** all 67 Java files parse with 0 syntax errors; with full attribution, **no** mismatched constructor/method calls into project classes (main and tests). Only unresolved symbols are Spring/Jakarta/Jackson/SLF4J types, which is expected without their jars.
- **SQL:** V1 and V2 parse as valid PostgreSQL; entity fields <-> columns cross-checked.
- **Contract:** every field the frontend's TypeScript types require exists in the Java DTOs; frontend: 62 tests, type-check, lint and production build pass.

**Written but not executed here:** the Spring wiring (security chain, CSRF, WebSocket config, JPA queries, Flyway on Postgres), plus `PoolServiceTest`, `PoolOrderServiceTest` (Mockito) and `ApiFlowIntegrationTest` (MockMvc over H2: login, CSRF, join, idempotent retry, conflict, cancel, privacy, CORS, admin lifecycle). Run `mvn test` first. If anything fails it will point at a specific line, and I'll fix it.

## Known gaps (not done, by design or scope)
- **No payment integration**: "total paid" is a computed number; wire a gateway before charging real money. Cancelling a deal therefore refunds nothing.
- **OTP state is in memory** (correct for one instance). For several instances back `OtpService` with Redis/DB.
- No per-IP rate limiting on `/api/auth/*`; add at the gateway/WAF.
- STOMP topic subscriptions are not authorised per society (the handshake is authenticated, pool data is low-sensitivity). Add a `ChannelInterceptor` if needed.
- Flyway 10 logs a warning that PostgreSQL 18 is newer than it was tested on (harmless; upgrade Flyway when Boot allows).
- Admin lists and "my orders" are not paginated.
- `SampleDataLoader` and the SQL seed in V1 are demo data; remove them for production.
