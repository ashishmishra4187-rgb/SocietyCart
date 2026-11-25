package com.societycart.domain.pool;

import com.societycart.common.ApiExceptions.ConflictException;
import com.societycart.domain.resident.Resident;
import com.societycart.dto.JoinPoolRequest;
import com.societycart.dto.OrderDetailView;
import com.societycart.dto.OrderView;
import com.societycart.dto.PoolView;
import com.societycart.web.PoolBroadcaster;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.societycart.dto.OrderHistoryPage;
import org.springframework.data.domain.PageRequest;
import java.util.EnumSet;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.UUID;

/**
 * Resident-facing order operations: join a pool, cancel, and read own orders.
 * Identity always comes from the authenticated resident, never from the request body.
 */
@Service
@Transactional(readOnly = true)
public class PoolOrderService {

    private static final int MAX_KEY_LENGTH = 100;

    private final PoolRepository poolRepository;
    private final PoolOrderRepository poolOrderRepository;
    private final PricingEngine pricingEngine;
    private final ViewMapper viewMapper;
    private final PoolBroadcaster broadcaster;

    public PoolOrderService(PoolRepository poolRepository,
                            PoolOrderRepository poolOrderRepository,
                            PricingEngine pricingEngine,
                            ViewMapper viewMapper,
                            PoolBroadcaster broadcaster) {
        this.poolRepository = poolRepository;
        this.poolOrderRepository = poolOrderRepository;
        this.pricingEngine = pricingEngine;
        this.viewMapper = viewMapper;
        this.broadcaster = broadcaster;
    }

    /**
     * Joins a pool. The pool row is locked first, so two neighbours joining in the same instant are
     * applied one after the other and the tier price is always computed from the true total.
     * A retry with the same Idempotency-Key is a no-op that returns the current pool state.
     */
    @Transactional
    public PoolView join(UUID poolId, Resident resident, JoinPoolRequest request, String idempotencyKey) {
        JoinPoolRequest.Item item = request.items().get(0);
        String key = normalizeKey(idempotencyKey);

        PoolWindow pool = poolRepository.findByIdForUpdate(poolId)
                .orElseThrow(() -> new NoSuchElementException("Pool not found"));
        PoolAccess.assertVisible(resident, pool);

        if (key != null) {
            Optional<PoolOrder> prior = poolOrderRepository.findByResidentIdAndIdempotencyKey(resident.getId(), key);
            if (prior.isPresent()) {
                return viewMapper.toPoolView(pool, participants(poolId));
            }
        }

        if (!pool.isOpen()) {
            throw new ConflictException("This deal has closed.");
        }
        if (!pool.getProductId().equals(item.sku())) {
            throw new IllegalArgumentException("That product is not part of this pool.");
        }
        int quantity = item.quantity();
        int max = pool.getMaxQuantityPerOrder() == null ? 20 : pool.getMaxQuantityPerOrder();
        if (quantity > max) {
            throw new IllegalArgumentException("You can order at most " + max + " units in this pool.");
        }
        if (poolOrderRepository.existsByPoolWindowIdAndResidentIdAndStatusNot(
                poolId, resident.getId(), PoolOrder.OrderStatus.CANCELLED)) {
            throw new ConflictException("You've already joined this deal.");
        }

        BigDecimal quotedPrice = pool.getCurrentUnitPrice();
        BigDecimal total = quotedPrice.multiply(BigDecimal.valueOf(quantity)).setScale(2, RoundingMode.HALF_UP);

        PoolOrder order = new PoolOrder();
        order.setPoolWindow(pool);
        order.setResident(resident);
        order.setResidentName(displayName(resident));
        order.setResidentEmail(resident.getEmail());
        order.setPhoneNumber(resident.getPhone());
        order.setFlatNumber(request.flatNumber().trim());
        order.setQuantity(quantity);
        order.setInitialUnitPrice(quotedPrice);
        order.setTotalPaid(total);
        order.setTotalSavings(BigDecimal.ZERO);
        order.setStatus(PoolOrder.OrderStatus.CONFIRMED);
        order.setIdempotencyKey(key);
        order.addItem(new PoolOrderItem(pool.getProductName(), quantity, quotedPrice));
        poolOrderRepository.save(order);

        recalculate(pool, pool.getCurrentTotalQuantity() + quantity);
        return publish(pool);
    }

    @Transactional
    public PoolView cancel(UUID poolId, UUID orderId, Resident resident) {
        PoolWindow pool = poolRepository.findByIdForUpdate(poolId)
                .orElseThrow(() -> new NoSuchElementException("Pool not found"));
        PoolAccess.assertVisible(resident, pool);

        PoolOrder order = poolOrderRepository.findOwned(orderId, resident.getId())
                .filter(o -> o.getPoolWindow().getId().equals(poolId))
                .orElseThrow(() -> new NoSuchElementException("Order not found"));

        if (order.getStatus() != PoolOrder.OrderStatus.CONFIRMED && order.getStatus() != PoolOrder.OrderStatus.PENDING) {
            throw new ConflictException("This order can no longer be cancelled.");
        }
        if (!pool.isOpen()) {
            throw new ConflictException("The pool has closed, so this order can no longer be cancelled.");
        }

        order.setStatus(PoolOrder.OrderStatus.CANCELLED);
        poolOrderRepository.save(order);
        recalculate(pool, Math.max(0, pool.getCurrentTotalQuantity() - order.getQuantity()));
        return publish(pool);
    }

    public List<OrderView> myOrders(UUID residentId) {
        return poolOrderRepository.findAllForResident(residentId).stream()
                .map(viewMapper::toOrderView)
                .toList();
    }

    public OrderHistoryPage history(UUID residentId, boolean past, int page) {
        var pastStatuses = EnumSet.of(PoolOrder.OrderStatus.DELIVERED, PoolOrder.OrderStatus.CANCELLED);
        var statuses = past ? pastStatuses : EnumSet.complementOf(pastStatuses);
        long activeCount = 0;
        long pastCount = 0;
        BigDecimal saved = BigDecimal.ZERO;
        for (var row : poolOrderRepository.totalsByStatus(residentId)) {
            if (pastStatuses.contains(row.getStatus())) pastCount += row.getOrders();
            else activeCount += row.getOrders();
            if (row.getStatus() == PoolOrder.OrderStatus.DELIVERED) saved = row.getSavings();
        }
        var orders = poolOrderRepository.history(residentId, statuses, PageRequest.of(page, 20))
                .stream().map(viewMapper::toOrderView).toList();
        return new OrderHistoryPage(orders, activeCount, pastCount, saved);
    }

    public OrderDetailView getOrder(UUID orderId, UUID residentId) {
        PoolOrder order = poolOrderRepository.findOwned(orderId, residentId)
                .orElseThrow(() -> new NoSuchElementException("Order not found"));
        return viewMapper.toOrderDetail(order, participants(order.getPoolWindow().getId()));
    }

    // ------------------------------------------------------------------ internals

    private void recalculate(PoolWindow pool, int newQuantity) {
        pool.setCurrentTotalQuantity(newQuantity);
        pool.setCurrentUnitPrice(pricingEngine.calculateCurrentPrice(pool, newQuantity));
        poolRepository.save(pool);
    }

    private PoolView publish(PoolWindow pool) {
        PoolView view = viewMapper.toPoolView(pool, participants(pool.getId()));
        broadcaster.poolUpdated(view);
        return view;
    }

    private int participants(UUID poolId) {
        return (int) poolOrderRepository.countByPoolWindowIdAndStatusNot(poolId, PoolOrder.OrderStatus.CANCELLED);
    }

    private static String displayName(Resident r) {
        if (r.getName() != null && !r.getName().isBlank()) {
            return r.getName();
        }
        return r.getFlatNumber() != null && !r.getFlatNumber().isBlank() ? "Resident " + r.getFlatNumber() : "Resident";
    }

    private static String normalizeKey(String key) {
        if (key == null || key.isBlank()) {
            return null;
        }
        String trimmed = key.trim();
        if (trimmed.length() > MAX_KEY_LENGTH) {
            throw new IllegalArgumentException("Idempotency-Key is too long.");
        }
        return trimmed;
    }
}
