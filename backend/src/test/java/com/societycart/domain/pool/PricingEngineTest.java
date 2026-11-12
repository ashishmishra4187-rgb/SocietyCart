package com.societycart.domain.pool;

import com.societycart.domain.society.Society;
import com.societycart.dto.PoolProgressDTO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class PricingEngineTest {

    private PricingEngine pricingEngine;
    private PoolWindow poolWindow;

    @BeforeEach
    void setUp() {
        pricingEngine = new PricingEngine();

        Society society = new Society(
                UUID.randomUUID(), "Test Society", "TST-01", "123 Main St",
                "Bengaluru", "Karnataka", "560001", 12.9716, 77.5946, 500.0, "Gate 1", true
        );

        poolWindow = new PoolWindow();
        poolWindow.setId(UUID.randomUUID());
        poolWindow.setSociety(society);
        poolWindow.setProductId("CPG-ATTA-10");
        poolWindow.setProductName("Chakki Atta 10kg");
        poolWindow.setBasePrice(new BigDecimal("400.00"));
        poolWindow.setCurrentUnitPrice(new BigDecimal("400.00"));
        poolWindow.setCurrentTotalQuantity(0);
        poolWindow.setTargetVolumeThreshold(50);
        poolWindow.setStartTime(Instant.now());
        poolWindow.setEndTime(Instant.now().plusSeconds(86400));

        // Tiers:
        // Tier 1: 1 unit, 0% off, 400.00
        // Tier 2: 10 units, 5% off, 380.00
        // Tier 3: 25 units, 15% off, 340.00
        // Tier 4: 50 units, 25% off, 300.00
        poolWindow.addPriceTier(new PriceTier(1, 1, new BigDecimal("0.00"), new BigDecimal("400.00"), "Base"));
        poolWindow.addPriceTier(new PriceTier(2, 10, new BigDecimal("5.00"), new BigDecimal("380.00"), "Community 5%"));
        poolWindow.addPriceTier(new PriceTier(3, 25, new BigDecimal("15.00"), new BigDecimal("340.00"), "Bulk 15%"));
        poolWindow.addPriceTier(new PriceTier(4, 50, new BigDecimal("25.00"), new BigDecimal("300.00"), "Wholesale 25%"));
    }

    @Test
    @DisplayName("Should return base tier when volume is below Tier 2")
    void testDetermineCurrentTier_BaseTier() {
        PriceTier tier = pricingEngine.determineCurrentTier(poolWindow, 5);
        assertEquals(1, tier.getTierLevel());
        assertEquals(new BigDecimal("400.00"), tier.getUnitPrice());
    }

    @Test
    @DisplayName("Should unlock Tier 2 when volume reaches 10 units")
    void testDetermineCurrentTier_Tier2() {
        PriceTier tier = pricingEngine.determineCurrentTier(poolWindow, 10);
        assertEquals(2, tier.getTierLevel());
        assertEquals(new BigDecimal("380.00"), tier.getUnitPrice());
    }

    @Test
    @DisplayName("Should unlock Tier 3 when volume reaches 30 units")
    void testDetermineCurrentTier_Tier3() {
        PriceTier tier = pricingEngine.determineCurrentTier(poolWindow, 30);
        assertEquals(3, tier.getTierLevel());
        assertEquals(new BigDecimal("340.00"), tier.getUnitPrice());
    }

    @Test
    @DisplayName("Should unlock Tier 4 when volume reaches 50 units")
    void testDetermineCurrentTier_Tier4() {
        PriceTier tier = pricingEngine.determineCurrentTier(poolWindow, 65);
        assertEquals(4, tier.getTierLevel());
        assertEquals(new BigDecimal("300.00"), tier.getUnitPrice());
    }

    @Test
    @DisplayName("Should calculate correct units needed for next tier")
    void testFindNextTierAndUnitsNeeded() {
        poolWindow.setCurrentTotalQuantity(7);
        PoolProgressDTO progress = pricingEngine.calculateProgress(poolWindow);

        assertEquals(10, progress.nextTierMinQuantity());
        assertEquals(3, progress.unitsNeededForNextTier()); // 10 - 7 = 3 units
        assertEquals(new BigDecimal("380.00"), progress.nextTierPrice());
    }

    @Test
    @DisplayName("Should settle all orders at lowest unlocked unit price and calculate savings")
    void testSettleOrders() {
        poolWindow.setCurrentTotalQuantity(30);
        poolWindow.setCurrentUnitPrice(new BigDecimal("340.00")); // Tier 3 unlocked

        PoolOrder order1 = new PoolOrder();
        order1.setQuantity(2);
        order1.setInitialUnitPrice(new BigDecimal("400.00")); // Paid at base MSRP
        order1.setTotalPaid(new BigDecimal("800.00"));
        order1.setStatus(PoolOrder.OrderStatus.CONFIRMED);

        PoolOrder order2 = new PoolOrder();
        order2.setQuantity(5);
        order2.setInitialUnitPrice(new BigDecimal("380.00")); // Paid at Tier 2
        order2.setTotalPaid(new BigDecimal("1900.00"));
        order2.setStatus(PoolOrder.OrderStatus.CONFIRMED);

        poolWindow.addOrder(order1);
        poolWindow.addOrder(order2);

        pricingEngine.settleOrders(poolWindow);

        assertEquals(PoolOrder.OrderStatus.SETTLED, order1.getStatus());
        assertEquals(new BigDecimal("340.00"), order1.getFinalSettledUnitPrice());
        // Order 1: Paid 800, actual cost 2 * 340 = 680, savings = 120
        assertEquals(new BigDecimal("120.00"), order1.getTotalSavings());

        assertEquals(PoolOrder.OrderStatus.SETTLED, order2.getStatus());
        assertEquals(new BigDecimal("340.00"), order2.getFinalSettledUnitPrice());
        // Order 2: Paid 1900, actual cost 5 * 340 = 1700, savings = 200
        assertEquals(new BigDecimal("200.00"), order2.getTotalSavings());
    }

    @Test
    @DisplayName("Below the first tier threshold the plain base price applies (no phantom discount)")
    void testBelowFirstTierUsesBasePrice() {
        // First real tier starts at 10 units; with 3 units nobody has earned a discount yet.
        PoolWindow pool = new PoolWindow();
        pool.setSociety(poolWindow.getSociety());
        pool.setBasePrice(new BigDecimal("200.00"));
        pool.addPriceTier(new PriceTier(1, 10, new BigDecimal("10.00"), new BigDecimal("180.00"), "10+"));

        assertEquals(new BigDecimal("200.00"), pricingEngine.calculateCurrentPrice(pool, 0));
        assertEquals(new BigDecimal("200.00"), pricingEngine.calculateCurrentPrice(pool, 9));
        assertEquals(new BigDecimal("180.00"), pricingEngine.calculateCurrentPrice(pool, 10));
    }

    @Test
    @DisplayName("Progress flags exactly one current tier, even when tiers are unsaved (null ids)")
    void testExactlyOneCurrentTier() {
        poolWindow.setCurrentTotalQuantity(30);
        PoolProgressDTO progress = pricingEngine.calculateProgress(poolWindow, 4);

        long current = progress.tiers().stream().filter(PoolProgressDTO.TierSummaryDTO::isCurrentTier).count();
        assertEquals(1, current);
        assertEquals(4, progress.totalOrdersCount());
    }

    @Test
    @DisplayName("Settlement never charges more than the price the resident was quoted when joining")
    void testSettleNeverExceedsQuotedPrice() {
        // Cancellations pushed the pool price back up to 380 after this resident joined at 340.
        poolWindow.setCurrentTotalQuantity(12);
        poolWindow.setCurrentUnitPrice(new BigDecimal("380.00"));

        PoolOrder order = new PoolOrder();
        order.setQuantity(2);
        order.setInitialUnitPrice(new BigDecimal("340.00"));
        order.setTotalPaid(new BigDecimal("680.00"));
        order.setStatus(PoolOrder.OrderStatus.CONFIRMED);
        poolWindow.addOrder(order);

        pricingEngine.settleOrders(poolWindow);

        assertEquals(new BigDecimal("340.00"), order.getFinalSettledUnitPrice());
        assertEquals(new BigDecimal("0.00"), order.getTotalSavings().setScale(2));
    }

    @Test
    @DisplayName("Cancelled orders are not settled and do not count as participants")
    void testCancelledOrdersIgnored() {
        poolWindow.setCurrentTotalQuantity(30);
        poolWindow.setCurrentUnitPrice(new BigDecimal("340.00"));

        PoolOrder cancelled = new PoolOrder();
        cancelled.setQuantity(1);
        cancelled.setInitialUnitPrice(new BigDecimal("400.00"));
        cancelled.setTotalPaid(new BigDecimal("400.00"));
        cancelled.setStatus(PoolOrder.OrderStatus.CANCELLED);
        poolWindow.addOrder(cancelled);

        pricingEngine.settleOrders(poolWindow);

        assertEquals(PoolOrder.OrderStatus.CANCELLED, cancelled.getStatus());
        assertNull(cancelled.getFinalSettledUnitPrice());
        assertEquals(0, pricingEngine.calculateProgress(poolWindow).totalOrdersCount());
    }

    @Test
    @DisplayName("planTiers prices each tier from its discount and keeps the ladder valid")
    void testPlanTiers() {
        var tiers = pricingEngine.planTiers(new BigDecimal("200"), new BigDecimal("120"), java.util.List.of(
                new PricingEngine.TierSpec(10, new BigDecimal("10")),
                new PricingEngine.TierSpec(20, new BigDecimal("28")),
                new PricingEngine.TierSpec(30, new BigDecimal("35"))));

        assertEquals(3, tiers.size());
        assertEquals(new BigDecimal("180.00"), tiers.get(0).getUnitPrice());
        assertEquals(new BigDecimal("144.00"), tiers.get(1).getUnitPrice());
        assertEquals(new BigDecimal("130.00"), tiers.get(2).getUnitPrice());
        assertEquals(1, tiers.get(0).getTierLevel());
        assertEquals(3, tiers.get(2).getTierLevel());
    }

    @Test
    @DisplayName("planTiers rejects bad ladders with a clear message")
    void testPlanTiersValidation() {
        BigDecimal base = new BigDecimal("200");
        BigDecimal floor = new BigDecimal("150");

        IllegalArgumentException belowFloor = assertThrows(IllegalArgumentException.class, () ->
                pricingEngine.planTiers(base, floor, java.util.List.of(new PricingEngine.TierSpec(10, new BigDecimal("40")))));
        assertTrue(belowFloor.getMessage().contains("below your floor"));

        assertThrows(IllegalArgumentException.class, () -> pricingEngine.planTiers(base, floor, java.util.List.of(
                new PricingEngine.TierSpec(20, new BigDecimal("10")), new PricingEngine.TierSpec(10, new BigDecimal("20")))));
        assertThrows(IllegalArgumentException.class, () -> pricingEngine.planTiers(base, floor, java.util.List.of(
                new PricingEngine.TierSpec(10, new BigDecimal("20")), new PricingEngine.TierSpec(20, new BigDecimal("10")))));
        assertThrows(IllegalArgumentException.class, () -> pricingEngine.planTiers(base, new BigDecimal("250"), java.util.List.of(
                new PricingEngine.TierSpec(10, new BigDecimal("5")))));
        assertThrows(IllegalArgumentException.class, () -> pricingEngine.planTiers(base, floor, java.util.List.of()));
    }
}
