@'
# SocietyCart

**Hyperlocal Housing-Society Bulk Grocery Group-Buying Platform**

SocietyCart enables residents within gated housing societies to pool daily grocery orders together to unlock tiered wholesale volume discounts, track live pool milestones in real time, and automate supplier purchase-order dispatch.

---
---

## Tech Stack

* **Backend:** Java, Spring Boot, Spring Security (OTP Auth + SPA CSRF Protection), Spring WebSocket (STOMP), Spring Data JPA, Flyway Migrations
* **Database:** PostgreSQL (with H2 `dev` profile for zero-setup local testing)
* **Frontend:** React, TypeScript, Tailwind CSS, Vite, Axios, STOMP WebSocket Client
* **Testing:** JUnit 5, Spring Boot Test (`ApiFlowIntegrationTest`), Vitest & React Testing Library

---

## Key Features

### Resident Portal
* **Society & Flat-Verified Onboarding:** OTP-based signup and login validated against society flat numbers (`FlatNumbers`, `OtpService`).
* **Dynamic Tiered Pricing (`PricingEngine`):** Unit prices drop automatically as aggregate society order quantity crosses configured `PriceTier` thresholds.
* **Real-Time Pool Updates (`STOMP` WebSockets):** Live progress bars and countdown timers (`LivePoolMeter`, `PoolBroadcaster`) update across connected clients without refreshing.
* **Order & Savings History:** End-to-end checkout, active pool tracking, and per-order savings breakdown (`MyOrdersPage`, `OrderDetailPage`).

### Society Admin Dashboard
* **Pool & Slab Configuration:** Create group-buying windows, configure tiered discount slabs (`TierEditor`), and edit pool cutoffs (`EditCutoffDialog`).
* **Automated Supplier Dispatch:** Scheduled `SupplierDispatchJob` closes expired pools and generates consolidated supplier purchase orders (`PurchaseOrderService`).
* **Flat-Wise Packing Manifests:** Auto-generated resident distribution lists (`PackingListCard`, `PoolDispatchPage`) with CSV export for doorstep delivery.

---

## Project Structure

```text
SocietyCart/
├── backend/                  # Spring Boot REST & WebSocket API
│   └── src/main/java/com/societycart/
│       ├── auth/             # OTP verification & resident session auth
│       ├── config/           # Security, SPA CSRF, WebSocket & scheduler configs
│       ├── domain/
│       │   ├── pool/         # PricingEngine, PoolService, PriceTier, PoolWindow
│       │   ├── fulfillment/  # PurchaseOrderService & SupplierDispatchJob
│       │   ├── product/      # Society product catalog management
│       │   └── society/      # Multi-society scoping & sample data seeders
│       ├── web/              # REST controllers & STOMP PoolBroadcaster
│       └── resources/db/migration/  # Flyway SQL migrations (V1 - V3)
├── frontend/                 # React + TypeScript + Tailwind SPA
│   └── src/
│       ├── api/              # Typed Axios clients (auth, pools, orders, admin)
│       ├── components/       # LivePoolMeter, TieredPricingCard, PackingListCard
│       ├── hooks/            # useStompWebSocket, useCountdown, useAuth
│       └── pages/            # SocietyDashboard, ProductPoolDetails, SocietyAdminPage
└── docs/screenshots/         # UI previews
