package com.societycart.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Real-time data transfer object broadcast via WebSockets and returned by REST API.
 * Powers the frontend LivePoolMeter and TieredPricingCard components.
 */
public record PoolProgressDTO(
        UUID poolId,
        UUID societyId,
        String societyName,
        String productId,
        String productName,
        String productDescription,
        String category,
        String unit,
        String imageUrl,
        BigDecimal basePrice,
        BigDecimal currentPrice,
        BigDecimal currentDiscountPercentage,
        Integer currentQuantity,
        Integer targetVolumeThreshold,
        Integer totalOrdersCount,
        String status,
        Instant startTime,
        Instant endTime,
        long timeRemainingSeconds,
        LocalDate expectedDeliveryDate,
        Integer nextTierMinQuantity,
        Integer unitsNeededForNextTier,
        BigDecimal nextTierDiscountPercentage,
        BigDecimal nextTierPrice,
        BigDecimal totalCommunitySavings,
        List<TierSummaryDTO> tiers
) {
    public record TierSummaryDTO(
            UUID id,
            Integer tierLevel,
            Integer minQuantity,
            BigDecimal discountPercentage,
            BigDecimal unitPrice,
            String description,
            boolean unlocked,
            boolean isCurrentTier
    ) {
    }
}
