package com.societycart.domain.pool;

import com.societycart.dto.AdminPoolView;
import com.societycart.dto.OrderDetailView;
import com.societycart.dto.OrderView;
import com.societycart.dto.PoolView;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;

/**
 * Translates domain entities into the exact JSON shapes the web app consumes, including the
 * vocabulary differences (e.g. internal SETTLED is shown to residents as "LOCKED").
 */
@Component
public class ViewMapper {

    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    private final PricingEngine pricingEngine;

    public ViewMapper(PricingEngine pricingEngine) {
        this.pricingEngine = pricingEngine;
    }

    public PoolView toPoolView(PoolWindow pool, int participantCount) {
        int qty = pool.getCurrentTotalQuantity();
        BigDecimal base = pool.getBasePrice().setScale(2, RoundingMode.HALF_UP);
        BigDecimal current = pool.getCurrentUnitPrice().setScale(2, RoundingMode.HALF_UP);

        // Derived from the two prices so the "-X%" badge always agrees with the price shown.
        BigDecimal savingsPercent = base.signum() == 0
                ? BigDecimal.ZERO.setScale(2)
                : base.subtract(current).max(BigDecimal.ZERO).multiply(HUNDRED).divide(base, 2, RoundingMode.HALF_UP);

        Integer unitsToNext = pricingEngine.findNextTier(pool, qty)
                .map(t -> Math.max(1, t.getMinQuantity() - qty))
                .orElse(null);

        List<PoolView.TierView> tiers = pool.getPriceTiers().stream()
                .sorted(Comparator.comparingInt(PriceTier::getMinQuantity))
                .map(t -> new PoolView.TierView(t.getMinQuantity(), t.getDiscountPercentage()))
                .toList();

        return new PoolView(
                pool.getId(),
                pool.getSociety().getId(),
                pool.getProductId(),
                pool.getProductName(),
                pool.getImageUrl(),
                null,
                base,
                current,
                savingsPercent,
                qty,
                participantCount,
                unitsToNext,
                tiers,
                poolStatus(pool.getStatus()),
                pool.getEndTime(),
                pool.getMaxQuantityPerOrder() == null ? 20 : pool.getMaxQuantityPerOrder()
        );
    }

    public OrderView toOrderView(PoolOrder order) {
        PoolWindow pool = order.getPoolWindow();
        // Price the resident will actually pay:
        //  - settled orders: the final settled price;
        //  - open orders: today's pool price, but never above what they were quoted when joining
        //    (the same rule settlement applies), so they can watch their price improve as neighbours join;
        //  - cancelled orders: the original quote.
        boolean open = order.getStatus() == PoolOrder.OrderStatus.CONFIRMED || order.getStatus() == PoolOrder.OrderStatus.PENDING;
        BigDecimal unit;
        if (order.getFinalSettledUnitPrice() != null) {
            unit = order.getFinalSettledUnitPrice();
        } else if (open) {
            unit = pool.getCurrentUnitPrice().min(order.getInitialUnitPrice());
        } else {
            unit = order.getInitialUnitPrice();
        }
        boolean priceIsFinal = !open;
        unit = unit.setScale(2, RoundingMode.HALF_UP);
        BigDecimal total = unit.multiply(BigDecimal.valueOf(order.getQuantity())).setScale(2, RoundingMode.HALF_UP);
        return new OrderView(
                order.getId(),
                pool.getId(),
                pool.getProductName(),
                pool.getImageUrl(),
                order.getQuantity(),
                unit,
                total,
                pool.getBasePrice().setScale(2, RoundingMode.HALF_UP),
                orderStatus(order.getStatus()),
                pool.getEndTime(),
                order.getCreatedAt(),
                poolStatus(pool.getStatus()),
                priceIsFinal
        );
    }

    public OrderDetailView toOrderDetail(PoolOrder order, int participantCount) {
        return new OrderDetailView(
                toOrderView(order),
                order.getOrderNumber(),
                order.getFlatNumber(),
                toPoolView(order.getPoolWindow(), participantCount)
        );
    }

    /** Admin view; the supplier PO preview exists once the pool has been closed. */
    public AdminPoolView toAdminView(PoolWindow pool, int participantCount) {
        AdminPoolView.SupplierPoSummary po = null;
        PoolWindow.PoolStatus s = pool.getStatus();
        if (s == PoolWindow.PoolStatus.LOCKED || s == PoolWindow.PoolStatus.BATCHING
                || s == PoolWindow.PoolStatus.DISPATCHED || s == PoolWindow.PoolStatus.COMPLETED) {
            LocalDate required = pool.getExpectedDeliveryDate();
            po = new AdminPoolView.SupplierPoSummary(
                    pool.getSociety().getName(),
                    pool.getSociety().getAddressLine() + ", " + pool.getSociety().getCity(),
                    pool.getProductId(),
                    pool.getCurrentTotalQuantity(),
                    pool.getCurrentUnitPrice().setScale(2, RoundingMode.HALF_UP),
                    required == null ? null : required.toString(),
                    pool.getDispatchedAt()
            );
        }
        return new AdminPoolView(toPoolView(pool, participantCount), po, pool.getDispatchedAt());
    }

    /** Internal pool status to the status vocabulary of the web app. */
    public static String poolStatus(PoolWindow.PoolStatus status) {
        return switch (status) {
            case OPEN -> "OPEN";
            case LOCKED, BATCHING -> "LOCKED";
            case DISPATCHED -> "DISPATCHED";
            case COMPLETED -> "DELIVERED";
            case CANCELLED -> "CANCELLED";
        };
    }

    /** Internal order status to the status vocabulary of the web app. */
    public static String orderStatus(PoolOrder.OrderStatus status) {
        return switch (status) {
            case PENDING, CONFIRMED -> "COMMITTED";
            case SETTLED -> "LOCKED";
            case DISPATCHED -> "DISPATCHED";
            case DELIVERED -> "DELIVERED";
            case CANCELLED -> "CANCELLED";
        };
    }
}
