package com.societycart.domain.pool;

import com.societycart.domain.resident.Resident;
import com.societycart.domain.society.Society;
import com.societycart.dto.AdminPoolView;
import com.societycart.dto.OrderView;
import com.societycart.dto.PoolView;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class ViewMapperTest {

    private ViewMapper mapper;
    private PoolWindow pool;
    private Society society;

    @BeforeEach
    void setUp() {
        mapper = new ViewMapper(new PricingEngine());
        society = new Society(UUID.randomUUID(), "Greenwood Heights", "GWH-01", "1 Park Rd", "Bengaluru",
                "Karnataka", "560001", 12.9, 77.6, 500.0, "Gate 2", true);

        pool = new PoolWindow();
        pool.setId(UUID.randomUUID());
        pool.setSociety(society);
        pool.setProductId("DEMO-MILK-A2");
        pool.setProductName("Organic Desi Cow A2 Milk 1L (Pack of 2)");
        pool.setBasePrice(new BigDecimal("200.00"));
        pool.setCurrentUnitPrice(new BigDecimal("144.00"));
        pool.setCurrentTotalQuantity(24);
        pool.setStatus(PoolWindow.PoolStatus.OPEN);
        pool.setEndTime(Instant.parse("2026-11-11T12:00:00Z"));
        pool.setMaxQuantityPerOrder(15);
        pool.setExpectedDeliveryDate(LocalDate.parse("2026-11-13"));
        pool.addPriceTier(new PriceTier(1, 10, new BigDecimal("10.00"), new BigDecimal("180.00"), "10+"));
        pool.addPriceTier(new PriceTier(2, 20, new BigDecimal("28.00"), new BigDecimal("144.00"), "20+"));
        pool.addPriceTier(new PriceTier(3, 30, new BigDecimal("35.00"), new BigDecimal("130.00"), "30+"));
    }

    @Test
    @DisplayName("Pool view carries every field the web app reads, in its vocabulary")
    void poolViewShape() {
        PoolView v = mapper.toPoolView(pool, 14);

        assertEquals(pool.getId(), v.poolWindowId());
        assertEquals(society.getId(), v.societyId());
        assertEquals("DEMO-MILK-A2", v.productSku(), "frontend orders against the SKU, not the pool id");
        assertEquals(new BigDecimal("200.00"), v.basePrice());
        assertEquals(new BigDecimal("144.00"), v.currentUnitPrice());
        assertEquals(new BigDecimal("28.00"), v.savingsPercent());
        assertEquals(24, v.aggregateQuantity());
        assertEquals(14, v.participantCount());
        assertEquals(6, v.unitsToNextTier());
        assertEquals("OPEN", v.status());
        assertEquals(Instant.parse("2026-11-11T12:00:00Z"), v.cutoffAt());
        assertEquals(15, v.maxQuantityPerOrder());
        assertEquals(3, v.tiers().size());
        assertEquals(10, v.tiers().get(0).minQuantity());
        assertEquals(new BigDecimal("35.00"), v.tiers().get(2).discountPercent());
    }

    @Test
    @DisplayName("No next tier at the top of the ladder; savings never negative")
    void topOfLadder() {
        pool.setCurrentTotalQuantity(40);
        pool.setCurrentUnitPrice(new BigDecimal("130.00"));
        assertNull(mapper.toPoolView(pool, 9).unitsToNextTier());

        pool.setCurrentUnitPrice(new BigDecimal("210.00"));
        assertEquals(new BigDecimal("0.00"), mapper.toPoolView(pool, 9).savingsPercent());
    }

    @Test
    @DisplayName("Internal statuses are translated to the web vocabulary")
    void statusMapping() {
        assertEquals("OPEN", ViewMapper.poolStatus(PoolWindow.PoolStatus.OPEN));
        assertEquals("LOCKED", ViewMapper.poolStatus(PoolWindow.PoolStatus.LOCKED));
        assertEquals("LOCKED", ViewMapper.poolStatus(PoolWindow.PoolStatus.BATCHING));
        assertEquals("DISPATCHED", ViewMapper.poolStatus(PoolWindow.PoolStatus.DISPATCHED));
        assertEquals("DELIVERED", ViewMapper.poolStatus(PoolWindow.PoolStatus.COMPLETED));
        assertEquals("CANCELLED", ViewMapper.poolStatus(PoolWindow.PoolStatus.CANCELLED));

        assertEquals("COMMITTED", ViewMapper.orderStatus(PoolOrder.OrderStatus.PENDING));
        assertEquals("COMMITTED", ViewMapper.orderStatus(PoolOrder.OrderStatus.CONFIRMED));
        assertEquals("LOCKED", ViewMapper.orderStatus(PoolOrder.OrderStatus.SETTLED));
        assertEquals("DISPATCHED", ViewMapper.orderStatus(PoolOrder.OrderStatus.DISPATCHED));
        assertEquals("DELIVERED", ViewMapper.orderStatus(PoolOrder.OrderStatus.DELIVERED));
        assertEquals("CANCELLED", ViewMapper.orderStatus(PoolOrder.OrderStatus.CANCELLED));
    }

    @Test
    @DisplayName("An open order shows TODAY's pool price (never above the quote) and is not final yet")
    void openOrderShowsLivePrice() {
        // Resident joined at 180 (10+ tier); the pool has since reached the 20+ tier at 144.
        PoolOrder order = new PoolOrder();
        order.setId(UUID.randomUUID());
        order.setPoolWindow(pool);
        order.setQuantity(3);
        order.setInitialUnitPrice(new BigDecimal("180.00"));
        order.setStatus(PoolOrder.OrderStatus.CONFIRMED);

        OrderView live = mapper.toOrderView(order);
        assertEquals(new BigDecimal("144.00"), live.unitPriceAtCommit(), "price improved as neighbours joined");
        assertEquals(new BigDecimal("432.00"), live.totalAmount());
        assertEquals("COMMITTED", live.status());
        assertEquals("OPEN", live.poolStatus());
        assertEquals(new BigDecimal("200.00"), live.basePrice());
        assertFalse(live.priceIsFinal(), "open pool: price can still change");

        // Cancellations pushed the pool price back above the quote: the resident is still capped at the quote.
        pool.setCurrentUnitPrice(new BigDecimal("190.00"));
        assertEquals(new BigDecimal("180.00"), mapper.toOrderView(order).unitPriceAtCommit());
    }

    @Test
    @DisplayName("After settlement the settled price is shown and is final; cancelled orders keep their quote")
    void settledAndCancelledOrders() {
        PoolOrder order = new PoolOrder();
        order.setId(UUID.randomUUID());
        order.setPoolWindow(pool);
        order.setQuantity(3);
        order.setInitialUnitPrice(new BigDecimal("180.00"));
        order.setFinalSettledUnitPrice(new BigDecimal("144.00"));
        order.setStatus(PoolOrder.OrderStatus.SETTLED);

        OrderView settled = mapper.toOrderView(order);
        assertEquals(new BigDecimal("144.00"), settled.unitPriceAtCommit());
        assertEquals(new BigDecimal("432.00"), settled.totalAmount());
        assertEquals("LOCKED", settled.status());
        assertTrue(settled.priceIsFinal());

        PoolOrder cancelled = new PoolOrder();
        cancelled.setId(UUID.randomUUID());
        cancelled.setPoolWindow(pool);
        cancelled.setQuantity(1);
        cancelled.setInitialUnitPrice(new BigDecimal("180.00"));
        cancelled.setStatus(PoolOrder.OrderStatus.CANCELLED);
        OrderView c = mapper.toOrderView(cancelled);
        assertEquals(new BigDecimal("180.00"), c.unitPriceAtCommit());
        assertTrue(c.priceIsFinal());
    }

    @Test
    @DisplayName("Supplier PO preview exists only once the pool has been closed")
    void adminPreview() {
        assertNull(mapper.toAdminView(pool, 3).supplierPOPayload(), "open pool has no PO yet");

        pool.setStatus(PoolWindow.PoolStatus.LOCKED);
        AdminPoolView locked = mapper.toAdminView(pool, 3);
        assertNotNull(locked.supplierPOPayload());
        assertEquals("Greenwood Heights", locked.supplierPOPayload().societyName());
        assertEquals("1 Park Rd, Bengaluru", locked.supplierPOPayload().deliveryAddress());
        assertEquals("DEMO-MILK-A2", locked.supplierPOPayload().sku());
        assertEquals(24, locked.supplierPOPayload().totalQuantity());
        assertEquals(new BigDecimal("144.00"), locked.supplierPOPayload().agreedUnitPrice());
        assertEquals("2026-11-13", locked.supplierPOPayload().requiredBy());
        assertEquals("LOCKED", locked.pool().status());
    }

    @Test
    @DisplayName("Resident admin helper")
    void residentRoles() {
        Resident r = new Resident(UUID.randomUUID(), society, "9876543210", "A", "B-1", Resident.Role.RESIDENT);
        assertFalse(r.isAdmin());
        r.setRole(Resident.Role.SOCIETY_ADMIN);
        assertTrue(r.isAdmin());
    }
}
