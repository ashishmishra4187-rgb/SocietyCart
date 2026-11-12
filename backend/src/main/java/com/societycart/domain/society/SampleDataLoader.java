package com.societycart.domain.society;

import com.societycart.domain.pool.PoolOrder;
import com.societycart.domain.pool.PoolOrderItem;
import com.societycart.domain.pool.PoolOrderRepository;
import com.societycart.domain.pool.PoolRepository;
import com.societycart.domain.pool.PoolWindow;
import com.societycart.domain.pool.PriceTier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

/**
 * Automatically seeds initial demo societies, active pooling windows,
 * dynamic tiered pricing, and sample orders if database is fresh.
 */
@Component
@Order(1)
public class SampleDataLoader implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(SampleDataLoader.class);

    private final SocietyRepository societyRepository;
    private final PoolRepository poolRepository;
    private final PoolOrderRepository poolOrderRepository;

    public SampleDataLoader(SocietyRepository societyRepository,
                            PoolRepository poolRepository,
                            PoolOrderRepository poolOrderRepository) {
        this.societyRepository = societyRepository;
        this.poolRepository = poolRepository;
        this.poolOrderRepository = poolOrderRepository;
    }

    @Override
    @Transactional
    public void run(String... args) {
        if (societyRepository.count() > 0) {
            log.info("Database already contains societies ({} found). Skipping sample seed.", societyRepository.count());
            return;
        }

        log.info("Seeding initial demo societies and CPG group-buying pools...");

        // 1. Create Society 1: Prestige Lakeside Habitat
        Society society1 = new Society();
        society1.setName("Prestige Lakeside Habitat");
        society1.setSocietyCode("PLH-BLR-01");
        society1.setAddressLine("Varthur Main Road, Whitefield");
        society1.setCity("Bengaluru");
        society1.setState("Karnataka");
        society1.setPostalCode("560087");
        society1.setLatitude(12.9558);
        society1.setLongitude(77.7471);
        society1.setGeofenceRadiusMeters(600.0);
        society1.setDeliveryGateNote("Gate 2 Security Hub - Drop near Tower 12 Clubhouse");
        society1.setActive(true);
        society1 = societyRepository.save(society1);

        // 2. Create Society 2: Sobha Dream Acres
        Society society2 = new Society();
        society2.setName("Sobha Dream Acres");
        society2.setSocietyCode("SDA-BLR-02");
        society2.setAddressLine("Panathur Road, Balagere");
        society2.setCity("Bengaluru");
        society2.setState("Karnataka");
        society2.setPostalCode("560087");
        society2.setLatitude(12.9365);
        society2.setLongitude(77.7289);
        society2.setGeofenceRadiusMeters(500.0);
        society2.setDeliveryGateNote("Gate 1 Main Gate - Delivery Bay A");
        society2.setActive(true);
        societyRepository.save(society2);

        // 3. Create Pool Window 1: Aashirvaad Atta 10kg
        PoolWindow attaPool = new PoolWindow();
        attaPool.setSociety(society1);
        attaPool.setProductId("CPG-ATTA-10KG");
        attaPool.setProductName("Aashirvaad Shudh Chakki Atta (10kg)");
        attaPool.setProductDescription("100% whole wheat flour, rich in natural dietary fibers. Direct farm procurement.");
        attaPool.setCategory("Staples & Grains");
        attaPool.setUnit("10 kg Bag");
        attaPool.setImageUrl("https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=400&q=80");
        attaPool.setBasePrice(new BigDecimal("450.00"));
        attaPool.setCurrentUnitPrice(new BigDecimal("427.50")); // Tier 2 active initially
        attaPool.setCurrentTotalQuantity(14);
        attaPool.setTargetVolumeThreshold(50);
        attaPool.setStatus(PoolWindow.PoolStatus.OPEN);
        attaPool.setStartTime(Instant.now().minus(2, ChronoUnit.HOURS));
        attaPool.setEndTime(Instant.now().plus(22, ChronoUnit.HOURS));
        attaPool.setExpectedDeliveryDate(LocalDate.now().plusDays(2));

        attaPool.addPriceTier(new PriceTier(1, 1, new BigDecimal("0.00"), new BigDecimal("450.00"), "Tier 1: Retail Price (1-9 bags)"));
        attaPool.addPriceTier(new PriceTier(2, 10, new BigDecimal("5.00"), new BigDecimal("427.50"), "Tier 2: Community Saver (10-24 bags) - 5% OFF"));
        attaPool.addPriceTier(new PriceTier(3, 25, new BigDecimal("12.00"), new BigDecimal("396.00"), "Tier 3: Bulk Power (25-49 bags) - 12% OFF"));
        attaPool.addPriceTier(new PriceTier(4, 50, new BigDecimal("20.00"), new BigDecimal("360.00"), "Tier 4: Wholesale Jackpot (50+ bags) - 20% OFF"));

        attaPool = poolRepository.save(attaPool);

        // Seed Sample Orders for Atta Pool
        PoolOrder order1 = new PoolOrder();
        order1.setPoolWindow(attaPool);
        order1.setResidentName("Rohan Verma");
        order1.setResidentEmail("rohan.verma@example.com");
        order1.setPhoneNumber("9876543210");
        order1.setFlatNumber("Tower 4 - 802");
        order1.setQuantity(6);
        order1.setInitialUnitPrice(new BigDecimal("450.00"));
        order1.setTotalPaid(new BigDecimal("2700.00"));
        order1.setStatus(PoolOrder.OrderStatus.CONFIRMED);
        order1.addItem(new PoolOrderItem("Aashirvaad Shudh Chakki Atta (10kg)", 6, new BigDecimal("450.00")));
        poolOrderRepository.save(order1);

        PoolOrder order2 = new PoolOrder();
        order2.setPoolWindow(attaPool);
        order2.setResidentName("Pooja Nair");
        order2.setResidentEmail("pooja.nair@example.com");
        order2.setPhoneNumber("9876543211");
        order2.setFlatNumber("Tower 8 - 1401");
        order2.setQuantity(8);
        order2.setInitialUnitPrice(new BigDecimal("427.50"));
        order2.setTotalPaid(new BigDecimal("3420.00"));
        order2.setStatus(PoolOrder.OrderStatus.CONFIRMED);
        order2.addItem(new PoolOrderItem("Aashirvaad Shudh Chakki Atta (10kg)", 8, new BigDecimal("427.50")));
        poolOrderRepository.save(order2);

        // 4. Create Pool Window 2: Fortune Sunflower Oil 5L
        PoolWindow oilPool = new PoolWindow();
        oilPool.setSociety(society1);
        oilPool.setProductId("CPG-OIL-5L");
        oilPool.setProductName("Fortune Sunlite Refined Sunflower Oil (5L Can)");
        oilPool.setProductDescription("Refined sunflower oil enriched with Vitamins A & D. Direct wholesale distributor pack.");
        oilPool.setCategory("Cooking Oils");
        oilPool.setUnit("5 Liter Can");
        oilPool.setImageUrl("https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=400&q=80");
        oilPool.setBasePrice(new BigDecimal("750.00"));
        oilPool.setCurrentUnitPrice(new BigDecimal("690.00")); // Tier 3 active initially
        oilPool.setCurrentTotalQuantity(28);
        oilPool.setTargetVolumeThreshold(60);
        oilPool.setStatus(PoolWindow.PoolStatus.OPEN);
        oilPool.setStartTime(Instant.now().minus(4, ChronoUnit.HOURS));
        oilPool.setEndTime(Instant.now().plus(20, ChronoUnit.HOURS));
        oilPool.setExpectedDeliveryDate(LocalDate.now().plusDays(2));

        oilPool.addPriceTier(new PriceTier(1, 1, new BigDecimal("0.00"), new BigDecimal("750.00"), "Tier 1: Retail Price (1-9 cans)"));
        oilPool.addPriceTier(new PriceTier(2, 10, new BigDecimal("4.00"), new BigDecimal("720.00"), "Tier 2: Neighborhood Tier (10-24 cans) - 4% OFF"));
        oilPool.addPriceTier(new PriceTier(3, 25, new BigDecimal("8.00"), new BigDecimal("690.00"), "Tier 3: Society Bulk (25-49 cans) - 8% OFF"));
        oilPool.addPriceTier(new PriceTier(4, 50, new BigDecimal("15.00"), new BigDecimal("637.50"), "Tier 4: Maximum Distributor Bulk (50+ cans) - 15% OFF"));

        poolRepository.save(oilPool);

        log.info("Demo data seeding completed successfully!");
    }
}
