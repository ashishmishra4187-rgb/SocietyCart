# SocietyCart

[![Build and tests](https://github.com/ashishmishra4187-rgb/SocietyCart/actions/workflows/ci.yml/badge.svg)](https://github.com/ashishmishra4187-rgb/SocietyCart/actions/workflows/ci.yml)

**Java 21 · Spring Boot · React · TypeScript · PostgreSQL · WebSockets**

Residents in the same housing society pool grocery orders to earn a volume discount. When a resident crosses a quantity threshold, everyone watching that deal sees the new unit price. Closing the pool settles all participating orders at the final price and produces a flat-by-flat packing list.

**Verified demo.** Two flats ordered one unit each. The second order triggered a 10% discount, both browsers updated from ₹200 to ₹180, and the final packing list reconciled to ₹360.

[Reproduce the demo](#try-the-two-resident-walkthrough) · [Explore the pricing engine](backend/src/main/java/com/societycart/domain/pool/PricingEngine.java) · [See the integration tests](backend/src/test/java/com/societycart/web/ApiFlowIntegrationTest.java)

## Run a local demo

Install JDK 21 and Node.js 22.12 or later. From the repository root, open two terminals.

**Backend (PowerShell)**

```powershell
cd backend
$env:SPRING_PROFILES_ACTIVE = "h2"
.\mvnw.cmd spring-boot:run
```

On macOS or Linux, run these commands from the repository root.

```bash
cd backend
SPRING_PROFILES_ACTIVE=h2 sh mvnw spring-boot:run
```

The API listens on port 8080. The H2 profile seeds demo data and resets when the backend stops. The default dev profile uses PostgreSQL.

**Frontend (second terminal)**

```sh
cd frontend
npm ci
npm run dev
```

Open [SocietyCart locally](http://localhost:5173). Vite proxies API and WebSocket traffic to the backend.

## Try the two-resident walkthrough

Use separate browser profiles for the admin and each resident so their session cookies stay independent. The local H2 verification code is `123456`.

1. Sign in as the seeded admin with `9000000001`. In the admin dashboard, add a product called **Demo Rice** with SKU `DEMO-RICE` and a usual price of ₹200. Open a deal with a base price of ₹200, a floor of ₹150, a future closing time, and a 10% discount starting at 2 units.
2. Sign in as the seeded resident with `9000000002` (flat B-202). In the other resident profile, create a resident account with a different demo mobile number and flat C-303. Select the same society as the admin.
3. Open Demo Rice in each resident profile. Keep the deal details visible and use a second tab in each profile for checkout. Order one unit as B-202. The pool stays at ₹200 per unit.
4. Order one unit as C-303. When the discount preview appears, select **Claim Discount & Continue**, then **Confirm order**. Both deal screens should show ₹180 per unit without a refresh.
5. Close the deal from the admin dashboard. Check each resident's order and the admin packing list. Each flat should have one unit at ₹180, for two units and ₹360 overall.

## Implementation

The backend uses Java 21, Spring Boot, Spring Security, Spring Data JPA, and STOMP over WebSockets. PostgreSQL schema changes use Flyway. The frontend uses React, TypeScript, Tailwind CSS, Vite, and React Query.

Residents can track deals, place and cancel eligible orders, and review their savings. Admins manage the product catalog and discount tiers, close deals, review purchase orders, and export packing lists. The scheduler closes expired pools. Supplier dispatch is simulated.

## Verify changes

From `backend`, run `./mvnw.cmd verify` in PowerShell or `sh mvnw verify` on macOS or Linux. From `frontend`, install dependencies with `npm ci`, then run:

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

[GitHub Actions](https://github.com/ashishmishra4187-rgb/SocietyCart/actions/workflows/ci.yml) runs these checks on pushes to main and on pull requests.

## Sample product photography

The two branded demo listings use pack photographs from [BigBasket's Aashirvaad 10 kg listing](https://www.bigbasket.com/pd/126906/aashirvaad-atta-whole-wheat-10-kg-pouch/) and [Fortune's Sunlite product page](https://www.fortunefoods.com/oil/fortune-sunlite-sunflower-oil/). Societies can supply their own catalogue photo when adding or editing a product.
