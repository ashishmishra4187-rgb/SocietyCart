package com.societycart.domain.society;

import com.societycart.domain.pool.PoolRepository;
import com.societycart.domain.pool.PoolService;
import com.societycart.domain.pool.PoolWindow;
import com.societycart.domain.product.ProductRepository;
import com.societycart.domain.product.ProductService;
import com.societycart.domain.resident.Resident;
import com.societycart.domain.resident.ResidentRepository;
import com.societycart.domain.resident.ResidentService;
import com.societycart.dto.AdminCreatePoolRequest;
import com.societycart.dto.ProductRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * Development convenience only (profiles "dev" and "h2"): makes the app usable right after the first start.
 * <ul>
 *   <li>Creates demo accounts if there are no residents yet: admin 9000000001 and resident 9000000002.</li>
 *   <li>Optionally promotes {@code societycart.dev.admin-phone} to society admin.</li>
 *   <li>Closes out demo deals whose time has run out, then opens fresh demo deals when the society has none running
 *       (the deals seeded earlier expire 24h after they are created).</li>
 * </ul>
 *
 * This runner must NEVER stop the application from starting: every step is guarded, and each service call runs in
 * its own transaction (so one failed step cannot mark the others rollback-only).
 */
@Component
@Profile({"dev", "h2"})
@Order(2)
public class DevDataSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DevDataSeeder.class);

    private final SocietyRepository societyRepository;
    private final ResidentRepository residentRepository;
    private final ResidentService residentService;
    private final PoolRepository poolRepository;
    private final PoolService poolService;
    private final ProductRepository productRepository;
    private final ProductService productService;
    private final Clock clock;
    private final String adminPhone;

    public DevDataSeeder(SocietyRepository societyRepository,
                         ResidentRepository residentRepository,
                         ResidentService residentService,
                         PoolRepository poolRepository,
                         PoolService poolService,
                         ProductRepository productRepository,
                         ProductService productService,
                         Clock clock,
                         @Value("${societycart.dev.admin-phone:}") String adminPhone) {
        this.societyRepository = societyRepository;
        this.residentRepository = residentRepository;
        this.residentService = residentService;
        this.poolRepository = poolRepository;
        this.poolService = poolService;
        this.productRepository = productRepository;
        this.productService = productService;
        this.clock = clock;
        this.adminPhone = adminPhone == null ? "" : adminPhone.trim();
    }

    // Deliberately NOT @Transactional: see the class comment.
    @Override
    public void run(String... args) {
        try {
            seed();
        } catch (RuntimeException e) {
            log.warn("DevDataSeeder: demo data could not be created ({}). The app starts anyway.", e.getMessage());
        }
    }

    private void seed() {
        List<Society> societies = societyRepository.findByActiveTrue();
        if (societies.isEmpty()) {
            log.info("DevDataSeeder: no societies yet, nothing to seed.");
            return;
        }
        Society society = societies.get(0);

        if (residentRepository.count() == 0) {
            residentService.ensureWithRole("9000000001", "Demo Admin", "A-101", society, Resident.Role.SOCIETY_ADMIN);
            residentService.ensureWithRole("9000000002", "Demo Resident", "B-202", society, Resident.Role.RESIDENT);
            log.warn("DevDataSeeder: created demo admin 9000000001 and resident 9000000002 in '{}'.", society.getName());
        }
        Resident admin = adminPhone.matches("^[6-9]\\d{9}$")
                ? residentService.ensureWithRole(adminPhone, "Society Admin", "A-1", society, Resident.Role.SOCIETY_ADMIN)
                : residentRepository.findByPhone("9000000001").orElse(null);

        Instant now = clock.instant();
        closeExpiredDeals(now);

        if (admin != null && poolRepository.findActivePoolsForSociety(society.getId(), now, PoolWindow.PoolStatus.OPEN).isEmpty()) {
            Instant cutoff = now.plus(Duration.ofHours(24));
            int opened = 0;
            opened += openDemoPool(admin, society, "DEMO-MILK-A2", "Organic Desi Cow A2 Milk 1L (Pack of 2)", "200", "120", cutoff,
                    tier(10, "10"), tier(20, "28"), tier(30, "35"));
            opened += openDemoPool(admin, society, "DEMO-ATTA-5KG", "Whole Wheat Atta 5kg", "450", "350", cutoff,
                    tier(10, "5"), tier(25, "12"), tier(50, "20"));
            opened += openDemoPool(admin, society, "DEMO-OIL-1L", "Sunflower Oil 1L", "180", "130", cutoff,
                    tier(10, "6"), tier(30, "14"), tier(60, "22"));
            log.warn("DevDataSeeder: opened {} fresh demo pool(s) closing in 24h.", opened);
        }
    }

    /** Locks (or cancels, if empty) deals whose closing time has passed, exactly as the scheduler would. */
    private void closeExpiredDeals(Instant now) {
        for (PoolWindow expired : poolRepository.findExpiredPoolWindows(PoolWindow.PoolStatus.OPEN, now)) {
            try {
                poolService.lockExpiredPool(expired.getId());
            } catch (RuntimeException e) {
                log.warn("DevDataSeeder: could not close expired deal {}: {}", expired.getId(), e.getMessage());
            }
        }
    }

    private static AdminCreatePoolRequest.TierInput tier(int min, String pct) {
        return new AdminCreatePoolRequest.TierInput(min, new BigDecimal(pct));
    }

    /** Returns 1 if the demo deal was opened, 0 if it could not be (logged, never thrown). */
    private int openDemoPool(Resident admin, Society society, String sku, String name, String base, String floor,
                             Instant cutoff, AdminCreatePoolRequest.TierInput... tiers) {
        try {
            // Deals are opened from the society's product list, so make sure the demo product is in it.
            if (!productRepository.existsBySocietyIdAndSku(society.getId(), sku)) {
                productService.create(new ProductRequest(society.getId(), sku, name, null, "Groceries", "unit", new BigDecimal(base)), admin);
            }
            poolService.createPool(new AdminCreatePoolRequest(
                    society.getId(), sku, new BigDecimal(base), new BigDecimal(floor), cutoff,
                    List.of(tiers), 20), admin);
            return 1;
        } catch (RuntimeException e) {
            log.warn("DevDataSeeder: skipped demo deal {}: {}", sku, e.getMessage());
            return 0;
        }
    }
}