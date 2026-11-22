@'
<div align="center">

# SocietyCart

**Hyperlocal Housing-Society Bulk Grocery Group-Buying Platform**

[![Java](https://img.shields.io/badge/Java-21-ED8B00?style=for-the-badge&logo=openjdk&logoColor=white)](https://openjdk.org/)
[![Spring Boot](https://img.shields.io/badge/Spring_Boot-3.x-6DB33F?style=for-the-badge&logo=springboot&logoColor=white)](https://spring.io/projects/spring-boot)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![React](https://img.shields.io/badge/React-18-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.x-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

*Pool daily grocery orders across your gated housing society to unlock tiered wholesale volume discounts, track live pool milestones over WebSockets, and automate supplier purchase-order dispatch.*

</div>

---

## Table of Contents

- [Overview](#overview)
- [System Architecture & Order Lifecycle](#system-architecture--order-lifecycle)
- [Core Engineering Highlights](#core-engineering-highlights)
- [Tech Stack](#tech-stack)
- [API & WebSocket Reference](#api--websocket-reference)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Running Tests](#running-tests)

---

## Overview

Individual households in gated residential societies routinely pay full retail prices for daily staples despite dozens of neighbors ordering the exact same SKUs every morning. **SocietyCart** solves this hyperlocal aggregation problem by turning each housing society into a shared buying pool:

1. **Residents** sign in via flat-verified OTP authentication and join active, time-bound product pools.
2. **Dynamic Tiered Pricing (`PricingEngine`)** recalculates the active unit price in real time as cumulative society order volume crosses configured `PriceTier` slabs.
3. **Live WebSocket Sync (`STOMP`)** broadcasts updated pool quantities, active tier unlocks, and countdown states to every connected resident without page reloads.
4. **Automated Fulfillment (`SupplierDispatchJob`)** locks pools at cutoff, consolidates society-wide demand into a single supplier purchase order, and generates flat-wise packing manifests for doorstep distribution.

---

## System Architecture & Order Lifecycle

```mermaid
flowchart TD
    subgraph Client ["Frontend SPA (React + TypeScript + Tailwind CSS)"]
        UI["Resident & Admin Portal<br/>(SocietyDashboard / ProductPoolDetails / AdminPage)"]
        WS_Client["STOMP WebSocket Client<br/>(useStompWebSocket)"]
    end

    subgraph Security ["Security & Session Layer"]
        Auth["AuthController & OtpService<br/>(Flat-Verified OTP Login)"]
        CSRF["SpaCsrfTokenRequestHandler & CsrfCookieFilter"]
    end

    subgraph Core ["Spring Boot Domain & Real-Time Engine"]
        PoolCtrl["PoolController & OrderController"]
        PoolSvc["PoolService & PoolOrderService<br/>(Transactional Order Placement)"]
        Pricing["PricingEngine<br/>(Dynamic Tiered Slab Evaluation)"]
        Broadcaster["PoolBroadcaster<br/>(STOMP /topic/pools/{poolId})"]
    end

    subgraph Fulfillment ["Scheduled Fulfillment Pipeline"]
        Job["SupplierDispatchJob<br/>(Automated Cutoff Closer)"]
        POSvc["PurchaseOrderService<br/>(Supplier PO & Flat Packing List)"]
    end

    subgraph Data ["Persistence Layer"]
        DB[("PostgreSQL Database<br/>(Flyway Migrations V1 - V3)")]
    end

    UI -->|"1. Request & Verify OTP"| Auth
    UI -.->|"XSRF-TOKEN Cookie"| CSRF
    UI -->|"2. Join Pool / Submit Order"| PoolCtrl
    PoolCtrl --> PoolSvc
    PoolSvc --> Pricing
    PoolSvc <-->|"3. ACID Pool & Order Persistence"| DB
    PoolSvc -->|"4. Publish PoolProgressDTO"| Broadcaster
    Broadcaster -.->|"5. Live Quantity & Tier Push"| WS_Client
    WS_Client -.->|"Instant LivePoolMeter Update"| UI

    Job -->|"6. Close Expired PoolWindows"| POSvc
    POSvc <-->|"7. Generate Consolidated PO & Flat Manifest"| DB
