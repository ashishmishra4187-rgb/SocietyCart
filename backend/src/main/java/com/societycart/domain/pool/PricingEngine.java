package com.societycart.domain.pool;

import com.societycart.dto.PoolProgressDTO;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

/**
 * Dynamic Tiered Pricing Engine.
 * Calculates real-time discount tiers based on aggregated community volume.
 * As more neighbors join the group deal, the unit price drops for all participants.
 */
@Component
public class PricingEngine {

    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    /** Admin input for one tier: "from N units, X% off". */
    public record TierSpec(int minQuantity, BigDecimal discountPercent) {
    }

    /**
     * Determines the current unlocked PriceTier based on the aggregated volume.
     * Below the first tier's threshold the price is the plain base price (no discount).
     */
    public PriceTier determineCurrentTier(PoolWindow poolWindow, int totalQuantity) {
        List<PriceTier> sortedTiers = poolWindow.getPriceTiers().stream()
                .sorted(Comparator.comparingInt(PriceTier::getMinQuantity))
                .toList();

        PriceTier baseTier = new PriceTier(0, 0, BigDecimal.ZERO, poolWindow.getBasePrice(), "Base price");

        PriceTier currentTier = baseTier;
        for (PriceTier tier : sortedTiers) {
            if (totalQuantity >= tier.getMinQuantity()) {
                currentTier = tier;
            } else {
                break;
            }
        }
        return currentTier;
    }

    /**
     * Calculates the unit price for the given total quantity.
     */
    public BigDecimal calculateCurrentPrice(PoolWindow poolWindow, int totalQuantity) {
        PriceTier tier = determineCurrentTier(poolWindow, totalQuantity);
        return tier.getUnitPrice();
    }

    /**
     * Finds the next locked tier that the community can unlock by pooling more units.
     */
    public Optional<PriceTier> findNextTier(PoolWindow poolWindow, int totalQuantity) {
        return poolWindow.getPriceTiers().stream()
                .sorted(Comparator.comparingInt(PriceTier::getMinQuantity))
                .filter(tier -> tier.getMinQuantity() > totalQuantity)
                .findFirst();
    }

    /**
     * Convenience overload that counts participants from the (lazy) orders collection.
     * Prefer {@link #calculateProgress(PoolWindow, int)} on hot paths: this loads every order.
     */
    public PoolProgressDTO calculateProgress(PoolWindow poolWindow) {
        int orderCount = poolWindow.getOrders() == null ? 0 : (int) poolWindow.getOrders().stream()
                .filter(o -> o.getStatus() != PoolOrder.OrderStatus.CANCELLED)
                .count();
        return calculateProgress(poolWindow, orderCount);
    }

    /**
     * Calculates a comprehensive PoolProgressDTO representation for live feeds & WebSockets.
     */
    public PoolProgressDTO calculateProgress(PoolWindow poolWindow, int orderCount) {
        int currentQty = poolWindow.getCurrentTotalQuantity();
        PriceTier currentTier = determineCurrentTier(poolWindow, currentQty);
        Optional<PriceTier> nextTierOpt = findNextTier(poolWindow, currentQty);

        BigDecimal basePrice = poolWindow.getBasePrice();
        BigDecimal currentPrice = currentTier.getUnitPrice();
        BigDecimal currentDiscount = currentTier.getDiscountPercentage();

        Integer nextTierMinQty = nextTierOpt.map(PriceTier::getMinQuantity).orElse(null);
        Integer unitsNeeded = nextTierOpt.map(tier -> Math.max(0, tier.getMinQuantity() - currentQty)).orElse(0);
        BigDecimal nextTierDiscount = nextTierOpt.map(PriceTier::getDiscountPercentage).orElse(currentDiscount);
        BigDecimal nextTierPrice = nextTierOpt.map(PriceTier::getUnitPrice).orElse(currentPrice);

        BigDecimal perUnitSavings = basePrice.subtract(currentPrice).max(BigDecimal.ZERO);
        BigDecimal totalCommunitySavings = perUnitSavings.multiply(BigDecimal.valueOf(currentQty));

        long timeRemaining = Duration.between(Instant.now(), poolWindow.getEndTime()).getSeconds();
        if (timeRemaining < 0) {
            timeRemaining = 0;
        }

        // Identity comparison on purpose: entity equals() is id-based and unsaved tiers all have a null id.
        List<PoolProgressDTO.TierSummaryDTO> tierSummaries = poolWindow.getPriceTiers().stream()
                .sorted(Comparator.comparingInt(PriceTier::getMinQuantity))
                .map(t -> new PoolProgressDTO.TierSummaryDTO(
                        t.getId(),
                        t.getTierLevel(),
                        t.getMinQuantity(),
                        t.getDiscountPercentage(),
                        t.getUnitPrice(),
                        t.getDescription(),
                        currentQty >= t.getMinQuantity(),
                        t == currentTier
                ))
                .toList();

        return new PoolProgressDTO(
                poolWindow.getId(),
                poolWindow.getSociety().getId(),
                poolWindow.getSociety().getName(),
                poolWindow.getProductId(),
                poolWindow.getProductName(),
                poolWindow.getProductDescription(),
                poolWindow.getCategory(),
                poolWindow.getUnit(),
                poolWindow.getImageUrl(),
                basePrice.setScale(2, RoundingMode.HALF_UP),
                currentPrice.setScale(2, RoundingMode.HALF_UP),
                currentDiscount.setScale(2, RoundingMode.HALF_UP),
                currentQty,
                poolWindow.getTargetVolumeThreshold(),
                orderCount,
                poolWindow.getStatus().name(),
                poolWindow.getStartTime(),
                poolWindow.getEndTime(),
                timeRemaining,
                poolWindow.getExpectedDeliveryDate(),
                nextTierMinQty,
                unitsNeeded,
                nextTierDiscount.setScale(2, RoundingMode.HALF_UP),
                nextTierPrice.setScale(2, RoundingMode.HALF_UP),
                totalCommunitySavings.setScale(2, RoundingMode.HALF_UP),
                tierSummaries
        );
    }

    /**
     * Settles all active orders when the pool closes. Everyone pays the pool's final unlocked price,
     * but never more than the price they were quoted when they joined (cancellations can push the
     * price back up after someone joined).
     */
    public void settleOrders(PoolWindow poolWindow) {
        BigDecimal poolFinalPrice = poolWindow.getCurrentUnitPrice();
        if (poolWindow.getOrders() == null) {
            return;
        }

        for (PoolOrder order : poolWindow.getOrders()) {
            if (order.getStatus() == PoolOrder.OrderStatus.CONFIRMED || order.getStatus() == PoolOrder.OrderStatus.PENDING) {
                BigDecimal orderFinalPrice = order.getInitialUnitPrice() == null
                        ? poolFinalPrice
                        : poolFinalPrice.min(order.getInitialUnitPrice());
                order.setFinalSettledUnitPrice(orderFinalPrice);
                BigDecimal finalTotalCost = orderFinalPrice.multiply(BigDecimal.valueOf(order.getQuantity()));
                BigDecimal savings = order.getTotalPaid().subtract(finalTotalCost).max(BigDecimal.ZERO);
                order.setTotalSavings(savings);
                order.setStatus(PoolOrder.OrderStatus.SETTLED);
            }
        }
    }

    /**
     * Turns admin "N units, X% off" specs into priced tiers, validating the ladder.
     *
     * @throws IllegalArgumentException with a user-facing message when the ladder is invalid
     */
    public List<PriceTier> planTiers(BigDecimal basePrice, BigDecimal floorPrice, List<TierSpec> specs) {
        if (specs == null || specs.isEmpty()) {
            throw new IllegalArgumentException("Add at least one discount tier.");
        }
        if (floorPrice.compareTo(basePrice) >= 0) {
            throw new IllegalArgumentException("Floor price must be lower than the base price.");
        }

        List<PriceTier> tiers = new ArrayList<>();
        int prevMin = 0;
        BigDecimal prevDiscount = BigDecimal.ZERO;
        int level = 1;
        for (TierSpec spec : specs) {
            if (spec.minQuantity() <= prevMin) {
                throw new IllegalArgumentException("Tier " + level + ": units must be higher than the previous tier.");
            }
            if (spec.discountPercent().compareTo(prevDiscount) <= 0) {
                throw new IllegalArgumentException("Tier " + level + ": discount must be higher than the previous tier.");
            }
            BigDecimal unitPrice = basePrice
                    .multiply(HUNDRED.subtract(spec.discountPercent()))
                    .divide(HUNDRED, 2, RoundingMode.HALF_UP);
            if (unitPrice.compareTo(floorPrice) < 0) {
                throw new IllegalArgumentException("Tier " + level + ": a " + spec.discountPercent().stripTrailingZeros().toPlainString()
                        + "% discount takes the price below your floor price.");
            }
            tiers.add(new PriceTier(level, spec.minQuantity(), spec.discountPercent().setScale(2, RoundingMode.HALF_UP),
                    unitPrice, spec.minQuantity() + "+ units: " + spec.discountPercent().stripTrailingZeros().toPlainString() + "% off"));
            prevMin = spec.minQuantity();
            prevDiscount = spec.discountPercent();
            level++;
        }
        return tiers;
    }
}
