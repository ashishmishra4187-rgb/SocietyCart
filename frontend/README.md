# SocietyCart Frontend

React 19 + TypeScript + Tailwind 3 + Vite. Resident app (OTP login, live deal pools, checkout, orders, profile) and society-admin tools (pool manager, supplier dispatch).

```bash
npm install
cp .env.example .env      # optional
npm run dev               # http://localhost:5173  (proxies /api and /ws to :8080)
npm test                  # 60 tests (vitest + Testing Library)
npm run typecheck && npm run lint && npm run build
```

## Routes
| Path | Page | Guard |
|---|---|---|
| `/login` | OTP login | public |
| `/s/:societyId` | Deals dashboard | auth |
| `/pools/:poolId` | Deal details (live) | auth |
| `/pools/:poolId/checkout` | Checkout | auth |
| `/orders`, `/orders/:orderId` | Orders / receipt | auth |
| `/profile` | Profile | auth |
| `/admin/s/:societyId` | Pool manager | `SOCIETY_ADMIN` |
| `/admin/pools/:id/dispatch` | Supplier PO + dispatch | `SOCIETY_ADMIN` |

(The old admin links pointed at `/s/admin`, which collided with `/s/:societyId`; admin now lives under `/admin/*`.)

## What changed vs. the original drop
**Bugs fixed**
- Checkout sent `sku: poolId`. It now sends `pool.productSku`.
- Checkout price is labelled *estimated* and is kept live by the WebSocket; a banner tells the resident if it moves while they are on the page.
- `Idempotency-Key` per checkout attempt prevents double orders (kept across network/5xx retries, rotated after a 4xx).
- Corrupt `localStorage` no longer crashes the app on load; sessions are validated.
- Hardcoded fallbacks removed ("Greenwood Heights", "Bengaluru", flat "A-402", fake PO address, fake phone digits).
- Dispatch no longer fakes a timestamp optimistically; it refetches the real PO.
- Admin pages had no way to reach dispatch; LOCKED pools now link to it.
- "Past" orders now means DELIVERED/CANCELLED only (LOCKED/DISPATCHED stay Active); per-card cancel spinner and cancel errors are shown.
- `₹143.5` style output, float noise in totals/savings.

**Security**: no token in `localStorage` (httpOnly cookie + `withCredentials`; optional in-memory bearer fallback). 401 on a protected call signs the user out. Same-origin-only post-login redirect. `RequireAuth` / `RequireAdmin` guards.

**Real-time**: `useStompWebSocket` writes validated frames into the React Query cache (details + checkout share one source), reconnects, refetches on every reconnect to recover missed updates, cleans up on unmount.

**Time**: one `useCountdown` hook; per-second precision in the last 5 minutes, 30 s otherwise; Checkout timer now updates.

**Accessibility**: AA contrast (savings green darkened `#16A34A -> #15803D`, 3.3:1 -> 5.0:1; secondary greys raised), skip link, focus moves to `<main>` on navigation, document titles, labelled progress bars, `aria-current` on tiers/nav, live regions, accessible modal (focus trap, Esc, focus restore), `prefers-reduced-motion`.

**Engineering**: route-level code splitting, error boundary, 404, shared `AppShell` / `BottomNav` / `StatusBadge` / states (removes ~4x duplicated nav), strict TS (`noUncheckedIndexedAccess`), no `any`, ESLint, 60 tests. Duplicate `_1/_2/_3` file variants merged into one each.

## Running with the backend (SocietyCartbackend)
1. Start Postgres and the backend (`mvn spring-boot:run`, profile `dev`, port 8080).
2. `npm run dev` here. Vite proxies `/api` and `/ws` to the backend, so the session cookie and CSRF cookie are same-origin.
3. Open the app. There are two tabs:
   - **Create account** (first time): pick *Resident* or *Society admin*, enter name, mobile, society and flat, then confirm the number with the OTP. The account is created only after the OTP is verified. Society admins must also enter the **admin code** (dev: `SOCIETY-ADMIN-DEMO`).
   - **Sign in** (returning users): enter your mobile and the OTP. A number with no account is told to create one; a number that already has an account is told to sign in.
   - In dev the OTP is always **123456** (also printed in the backend console). Ready-made accounts: admin `9000000001`, resident `9000000002`. A yellow "Demo mode" box on the login page repeats this (shown in `npm run dev`, or when `VITE_DEMO_MODE=true`).

## Backend contract (implemented by the backend in this repo)
- Auth: `GET /api/auth/societies` (public, for the sign-up dropdown), `POST /api/auth/signup`, `/otp` (sign in), `/verify`, `/logout`; session in an httpOnly `SC_SESSION` cookie; CSRF via `XSRF-TOKEN` cookie + `X-XSRF-TOKEN` header (axios does this automatically). 401 = signed out.
- Residents/societies: `GET|PATCH /api/residents/me`, `GET /api/societies`, `GET /api/societies/{id}`.
- Pools/orders: `GET /api/pools/society/{id}`, `GET /api/pools/{id}`, `POST /api/pools/{id}/orders` (+`Idempotency-Key`), `DELETE /api/pools/{id}/orders/{orderId}`, `GET /api/orders/me`, `GET /api/orders/{id}`.
- Admin (`SOCIETY_ADMIN` / `PLATFORM_ADMIN`): `GET|POST /api/admin/pools`, `GET /api/admin/pools/{id}`, `PATCH /api/admin/pools/{id}` (change closing time), `POST .../close`, `.../cancel`, `.../dispatch`, `.../deliver`, `GET .../packing-list`; product catalog `GET|POST /api/admin/products`, `PATCH /api/admin/products/{id}` (edit, archive/restore).
- Realtime: STOMP over native WebSocket at `/ws`, topic `/topic/pools/{poolId}` (full pool JSON).
- Errors are `{ "timestamp", "status", "error", "message" }`; the UI shows `message`.
