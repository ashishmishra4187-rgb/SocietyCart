package com.societycart.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * The pool shape the resident web app consumes (REST responses and WebSocket frames).
 * Field names are a public contract with the frontend ({@code PoolProgress} type).
 */
public record PoolView(
        UUID poolWindowId,
        UUID societyId,
        String productSku,
        String productName,
        String imageUrl,
        String supplierName,
        BigDecimal basePrice,
        BigDecimal currentUnitPrice,
        BigDecimal savingsPercent,
        int aggregateQuantity,
        int participantCount,
        Integer unitsToNextTier,
        List<TierView> tiers,
        String status,
        Instant cutoffAt,
        int maxQuantityPerOrder
) {
    public record TierView(int minQuantity, BigDecimal discountPercent) {
    }
}
