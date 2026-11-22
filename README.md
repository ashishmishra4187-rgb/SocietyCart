@'
# SocietyCart

**Hyperlocal Housing-Society Bulk Grocery Group-Buying Platform**

SocietyCart enables residents within gated housing societies to pool daily grocery orders together to unlock tiered wholesale volume discounts, track live pool milestones in real time, and automate supplier purchase-order dispatch.

---

## System Architecture & Group-Buying Flow

```mermaid
flowchart TD
    subgraph Client ["Frontend (React + TypeScript + Tailwind CSS)"]
        UI["Resident & Admin Portal"]
        WS_Client["STOMP WebSocket Hook<br/>(useStompWebSocket)"]
    end

    subgraph Backend ["Backend (Java + Spring Boot + Spring Security)"]
        Auth["OTP Auth & SPA CSRF Filter<br/>(AuthController / OtpService)"]
        PoolCtrl["Pool & Order REST APIs<br/>(PoolController / OrderController)"]
        Engine["PoolService & PricingEngine<br/>(Tiered Volume Discount Logic)"]
        Broadcaster["STOMP PoolBroadcaster<br/>(/topic/pools/{poolId})"]
        Scheduler["SupplierDispatchJob<br/>(Scheduled Cutoff Closer)"]
        Fulfillment["PurchaseOrderService<br/>(Supplier PO & Flat Packing List)"]
    end

    subgraph Storage ["Database & Migrations"]
        DB[("PostgreSQL<br/>(Flyway V1 - V3)")]
    end

    UI -->|"1. OTP Login & Flat Verification"| Auth
    UI -->|"2. Join Pool / Place Order"| PoolCtrl
    PoolCtrl --> Engine
    Engine <-->|"3. Transactional Pool & Tier Read/Write"| DB
    Engine -->|"4. Trigger Progress Event"| Broadcaster
    Broadcaster -.->|"5. Real-Time Price & Quantity Push"| WS_Client
    WS_Client -.->|"Live Meter Update"| UI

    Scheduler -->|"6. Lock Expired Pool Windows"| Fulfillment
    Fulfillment <-->|"7. Generate Supplier PO & Manifest"| DB
