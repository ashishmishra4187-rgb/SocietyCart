package com.societycart.domain.pool;

import com.societycart.common.ApiExceptions.ConflictException;
import com.societycart.common.FlatNumbers;
import com.societycart.domain.fulfillment.PurchaseOrderService;
import com.societycart.domain.product.Product;
import com.societycart.domain.product.ProductRepository;
import com.societycart.domain.resident.Resident;
import com.societycart.domain.society.Society;
import com.societycart.domain.society.SocietyRepository;
import com.societycart.dto.AdminCreatePoolRequest;
import com.societycart.dto.AdminPoolView;
import com.societycart.dto.OrderView;
import com.societycart.dto.PackingListView;
import com.societycart.dto.PoolView;
import com.societycart.web.PoolBroadcaster;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.UUID;

/**
 * Pool reads plus the pool lifecycle:
 * OPEN -> LOCKED (closed, prices settled) -> DISPATCHED (PO sent to supplier) -> COMPLETED (delivered).
 *
 * Every state change takes a row lock on the pool, so concurrent residents, the scheduler and admins
 * can never interleave. Live broadcasts are queued to run only after the transaction commits.
 */
@Service
@Transactional(readOnly = true)
public class PoolService {

    private static final Logger log = LoggerFactory.getLogger(PoolService.class);

    private final PoolRepository poolRepository;
    private final PoolOrderRepository poolOrderRepository;
    private final SocietyRepository societyRepository;
    private final ProductRepository productRepository;
    private final PricingEngine pricingEngine;
    private final ViewMapper viewMapper;
    private final PoolBroadcaster broadcaster;
    private final PurchaseOrderService purchaseOrderService;
    private final Clock clock;

    public PoolService(PoolRepository poolRepository,
                       PoolOrderRepository poolOrderRepository,
                       SocietyRepository societyRepository,
                       ProductRepository productRepository,
                       PricingEngine pricingEngine,
                       ViewMapper viewMapper,
                       PoolBroadcaster broadcaster,
                       PurchaseOrderService purchaseOrderService,
                       Clock clock) {
        this.poolRepository = poolRepository;
        this.poolOrderRepository = poolOrderRepository;
        this.societyRepository = societyRepository;
        this.productRepository = productRepository;
        this.pricingEngine = pricingEngine;
        this.viewMapper = viewMapper;
        this.broadcaster = broadcaster;
        this.purchaseOrderService = purchaseOrderService;
        this.clock = clock;
    }

    // ------------------------------------------------------------------ reads

    public PoolView getPoolView(UUID poolId, Resident caller) {
        PoolWindow pool = poolRepository.findByIdWithTiers(poolId)
                .orElseThrow(() -> new NoSuchElementException("Pool not found"));
        PoolAccess.assertVisible(caller, pool);
        return viewMapper.toPoolView(pool, participants(poolId));
    }

    public List<PoolView> getOpenPoolViews(UUID societyId, Resident caller) {
        PoolAccess.assertSocietyVisible(caller, societyId);
        List<PoolWindow> pools = poolRepository.findActivePoolsForSociety(societyId, clock.instant(), PoolWindow.PoolStatus.OPEN);
        return toViews(pools);
    }

    public List<PoolView> listForAdmin(UUID societyId, Resident admin) {
        PoolAccess.assertAdminOf(admin, societyId);
        return toViews(poolRepository.findAllForSociety(societyId));
    }

    public AdminPoolView getAdminView(UUID poolId, Resident admin) {
        PoolWindow pool = poolRepository.findByIdWithTiers(poolId)
                .orElseThrow(() -> new NoSuchElementException("Pool not found"));
        PoolAccess.assertAdminOf(admin, pool.getSociety().getId());
        return viewMapper.toAdminView(pool, participants(poolId));
    }

    // ------------------------------------------------------------------ admin writes

    @Transactional
    public PoolView createPool(AdminCreatePoolRequest req, Resident admin) {
        PoolAccess.assertAdminOf(admin, req.societyId());
        Society society = societyRepository.findById(req.societyId())
                .orElseThrow(() -> new NoSuchElementException("Society not found"));

        Instant now = clock.instant();
        if (!req.cutoffAt().isAfter(now.plus(Duration.ofMinutes(5)))) {
            throw new IllegalArgumentException("Closing time must be at least 5 minutes from now.");
        }
        if (req.floorPrice().compareTo(req.basePrice()) >= 0) {
            throw new IllegalArgumentException("Floor price must be lower than the base retail price.");
        }
        String sku = req.productSku().trim();
        // The name, photo, category and unit come from the society's catalog, never from the request.
        Product product = productRepository.findBySocietyIdAndSku(society.getId(), sku)
                .filter(Product::isActive)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Add this product to your product list first (SKU " + sku + ")."));
        if (poolRepository.existsBySocietyIdAndProductIdAndStatus(society.getId(), sku, PoolWindow.PoolStatus.OPEN)) {
            throw new ConflictException("An open pool for this product already exists.");
        }

        List<PricingEngine.TierSpec> specs = req.tiers().stream()
                .map(t -> new PricingEngine.TierSpec(t.minQuantity(), t.discountPercent()))
                .sorted(Comparator.comparingInt(PricingEngine.TierSpec::minQuantity))
                .toList();
        List<PriceTier> tiers = pricingEngine.planTiers(req.basePrice(), req.floorPrice(), specs);

        PoolWindow pool = new PoolWindow();
        pool.setSociety(society);
        pool.setProductId(sku);
        pool.setProductName(product.getName());
        pool.setCategory(product.getCategory());
        pool.setUnit(product.getUnit());
        pool.setImageUrl(product.getImageUrl());
        pool.setBasePrice(req.basePrice());
        pool.setCurrentUnitPrice(req.basePrice());
        pool.setFloorPrice(req.floorPrice());
        pool.setMaxQuantityPerOrder(req.maxQuantityPerOrder() == null ? 20 : req.maxQuantityPerOrder());
        pool.setCurrentTotalQuantity(0);
        pool.setTargetVolumeThreshold(tiers.get(tiers.size() - 1).getMinQuantity());
        pool.setStatus(PoolWindow.PoolStatus.OPEN);
        pool.setStartTime(now);
        pool.setEndTime(req.cutoffAt());
        pool.setExpectedDeliveryDate(LocalDate.ofInstant(req.cutoffAt(), ZoneId.systemDefault()).plusDays(2));
        tiers.forEach(pool::addPriceTier);

        PoolWindow saved = poolRepository.save(pool);
        log.info("Admin {} opened pool {} ({}) for society {}", admin.getId(), saved.getId(), sku, society.getName());
        PoolView view = viewMapper.toPoolView(saved, 0);
        broadcaster.poolUpdated(view);
        return view;
    }

    /** Admin closes a pool early: no more joins, everyone's final price is settled. */
    @Transactional
    public PoolView lockPool(UUID poolId, Resident admin) {
        PoolWindow pool = lockRow(poolId);
        PoolAccess.assertAdminOf(admin, pool.getSociety().getId());
        return lockInternal(pool);
    }

    /** Admin sends the consolidated purchase order to the supplier. Cannot be repeated. */
    @Transactional
    public AdminPoolView dispatchPool(UUID poolId, Resident admin) {
        PoolWindow pool = lockRow(poolId);
        PoolAccess.assertAdminOf(admin, pool.getSociety().getId());
        dispatchInternal(pool);
        return viewMapper.toAdminView(pool, participants(poolId));
    }

    @Transactional
    public AdminPoolView markDelivered(UUID poolId, Resident admin) {
        PoolWindow pool = lockRow(poolId);
        PoolAccess.assertAdminOf(admin, pool.getSociety().getId());
        if (pool.getStatus() != PoolWindow.PoolStatus.DISPATCHED) {
            throw new IllegalStateException("Only dispatched pools can be marked delivered (current status: " + pool.getStatus() + ").");
        }
        for (PoolOrder order : pool.getOrders()) {
            if (order.getStatus() == PoolOrder.OrderStatus.DISPATCHED) {
                order.setStatus(PoolOrder.OrderStatus.DELIVERED);
            }
        }
        pool.setStatus(PoolWindow.PoolStatus.COMPLETED);
        poolRepository.save(pool);
        publish(pool, "COMPLETED", "Delivered to the community");
        return viewMapper.toAdminView(pool, participants(poolId));
    }

    /**
     * Changes when an open deal closes. Extending is always safe for residents (the price can only improve with
     * more neighbours); shortening is allowed as long as the new time is still in the future.
     */
    @Transactional
    public PoolView updateCutoff(UUID poolId, Instant newCutoff, Resident admin) {
        PoolWindow pool = lockRow(poolId);
        PoolAccess.assertAdminOf(admin, pool.getSociety().getId());
        if (pool.getStatus() != PoolWindow.PoolStatus.OPEN) {
            throw new IllegalStateException("Only open deals can change their closing time (current status: " + pool.getStatus() + ").");
        }
        Instant now = clock.instant();
        if (!newCutoff.isAfter(now.plus(Duration.ofMinutes(5)))) {
            throw new IllegalArgumentException("Closing time must be at least 5 minutes from now.");
        }
        if (newCutoff.isAfter(now.plus(Duration.ofDays(30)))) {
            throw new IllegalArgumentException("Closing time must be within 30 days.");
        }
        pool.setEndTime(newCutoff);
        pool.setExpectedDeliveryDate(LocalDate.ofInstant(newCutoff, ZoneId.systemDefault()).plusDays(2));
        poolRepository.save(pool);
        log.info("Admin {} moved closing time of pool {} to {}", admin.getId(), poolId, newCutoff);
        publish(pool, "OPEN", "Closing time changed");
        return viewMapper.toPoolView(pool, participants(poolId));
    }

    /**
     * Cancels a deal before the supplier has been ordered. Every active order is cancelled with it.
     * (Nobody is charged yet, so there is nothing to refund.)
     */
    @Transactional
    public PoolView cancelPool(UUID poolId, Resident admin) {
        PoolWindow pool = lockRow(poolId);
        PoolAccess.assertAdminOf(admin, pool.getSociety().getId());
        if (pool.getStatus() != PoolWindow.PoolStatus.OPEN && pool.getStatus() != PoolWindow.PoolStatus.LOCKED) {
            throw new IllegalStateException("Only open or closed (not yet dispatched) deals can be cancelled (current status: "
                    + pool.getStatus() + ").");
        }
        for (PoolOrder order : pool.getOrders()) {
            if (order.getStatus() != PoolOrder.OrderStatus.CANCELLED) {
                order.setStatus(PoolOrder.OrderStatus.CANCELLED);
            }
        }
        pool.setStatus(PoolWindow.PoolStatus.CANCELLED);
        poolRepository.save(pool);
        log.info("Admin {} cancelled pool {}", admin.getId(), poolId);
        publish(pool, "CANCELLED", "Deal cancelled by the society admin");
        return viewMapper.toPoolView(pool, participants(poolId));
    }

    /** Flat-by-flat list of who gets how many units (cancelled orders excluded), in natural flat order. */
    public PackingListView packingList(UUID poolId, Resident admin) {
        PoolWindow pool = poolRepository.findByIdWithTiers(poolId)
                .orElseThrow(() -> new NoSuchElementException("Pool not found"));
        PoolAccess.assertAdminOf(admin, pool.getSociety().getId());

        List<PoolOrder> orders = poolOrderRepository.findByPoolWindowId(poolId).stream()
                .filter(o -> o.getStatus() != PoolOrder.OrderStatus.CANCELLED)
                .sorted((a, b) -> FlatNumbers.compare(a.getFlatNumber(), b.getFlatNumber()))
                .toList();

        int totalUnits = 0;
        BigDecimal totalAmount = BigDecimal.ZERO;
        List<PackingListView.Line> lines = new java.util.ArrayList<>();
        for (PoolOrder o : orders) {
            OrderView v = viewMapper.toOrderView(o);
            totalUnits += o.getQuantity();
            totalAmount = totalAmount.add(v.totalAmount());
            lines.add(new PackingListView.Line(o.getFlatNumber(), o.getResidentName(), o.getPhoneNumber(),
                    o.getQuantity(), v.unitPriceAtCommit(), v.totalAmount(), v.status()));
        }
        return new PackingListView(pool.getId(), pool.getProductName(), pool.getProductId(), pool.getUnit(),
                totalUnits, totalAmount.setScale(2, RoundingMode.HALF_UP), lines);
    }

    // ------------------------------------------------------------------ scheduler (system) paths

    /** Locks a pool whose cut-off has passed. Safe to call repeatedly or from several instances. */
    @Transactional
    public boolean lockExpiredPool(UUID poolId) {
        PoolWindow pool = lockRow(poolId);
        if (pool.getStatus() != PoolWindow.PoolStatus.OPEN || pool.getEndTime().isAfter(clock.instant())) {
            return false;
        }
        lockInternal(pool);
        return true;
    }

    @Transactional
    public void dispatchSystem(UUID poolId) {
        PoolWindow pool = lockRow(poolId);
        if (pool.getStatus() == PoolWindow.PoolStatus.LOCKED) {
            dispatchInternal(pool);
        }
    }

    // ------------------------------------------------------------------ internals

    private PoolWindow lockRow(UUID poolId) {
        return poolRepository.findByIdForUpdate(poolId)
                .orElseThrow(() -> new NoSuchElementException("Pool not found"));
    }

    private PoolView lockInternal(PoolWindow pool) {
        if (pool.getStatus() != PoolWindow.PoolStatus.OPEN) {
            throw new IllegalStateException("Only open pools can be closed (current status: " + pool.getStatus() + ").");
        }
        if (pool.getCurrentTotalQuantity() <= 0) {
            // Nothing was ordered: there is nothing to settle or send to a supplier.
            pool.setStatus(PoolWindow.PoolStatus.CANCELLED);
            poolRepository.save(pool);
            publish(pool, "CANCELLED", "Closed with no orders");
            return viewMapper.toPoolView(pool, 0);
        }
        pool.setStatus(PoolWindow.PoolStatus.LOCKED);
        pricingEngine.settleOrders(pool);
        poolRepository.save(pool);
        publish(pool, "LOCKED", "Pool closed. Final price " + pool.getCurrentUnitPrice() + " per unit");
        return viewMapper.toPoolView(pool, participants(pool.getId()));
    }

    private void dispatchInternal(PoolWindow pool) {
        if (pool.getStatus() != PoolWindow.PoolStatus.LOCKED) {
            throw new IllegalStateException("Only closed pools can be dispatched (current status: " + pool.getStatus() + ").");
        }
        purchaseOrderService.generateAndDispatchPurchaseOrder(pool);
        for (PoolOrder order : pool.getOrders()) {
            if (order.getStatus() == PoolOrder.OrderStatus.SETTLED) {
                order.setStatus(PoolOrder.OrderStatus.DISPATCHED);
            }
        }
        pool.setStatus(PoolWindow.PoolStatus.DISPATCHED);
        pool.setDispatchedAt(clock.instant());
        poolRepository.save(pool);
        publish(pool, "DISPATCHED", "Order dispatched to supplier");
    }

    private void publish(PoolWindow pool, String status, String message) {
        broadcaster.poolUpdated(viewMapper.toPoolView(pool, participants(pool.getId())));
        broadcaster.statusChanged(pool.getId(), pool.getSociety().getId(), status, message);
    }

    private int participants(UUID poolId) {
        return (int) poolOrderRepository.countByPoolWindowIdAndStatusNot(poolId, PoolOrder.OrderStatus.CANCELLED);
    }

    private List<PoolView> toViews(Collection<PoolWindow> pools) {
        if (pools.isEmpty()) {
            return List.of();
        }
        Map<UUID, Integer> counts = new HashMap<>();
        for (Object[] row : poolOrderRepository.countByPool(
                pools.stream().map(PoolWindow::getId).toList(), PoolOrder.OrderStatus.CANCELLED)) {
            counts.put((UUID) row[0], ((Number) row[1]).intValue());
        }
        return pools.stream()
                .map(p -> viewMapper.toPoolView(p, counts.getOrDefault(p.getId(), 0)))
                .toList();
    }
}
