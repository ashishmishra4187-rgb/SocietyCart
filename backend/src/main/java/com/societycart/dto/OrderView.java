package com.societycart.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** A resident's order as shown in "My orders". Statuses are the frontend vocabulary. */
public record OrderView(
        UUID orderId,
        UUID poolWindowId,
        String productName,
        String imageUrl,
        int quantity,
        BigDecimal unitPriceAtCommit,
        BigDecimal totalAmount,
        BigDecimal basePrice,
        String status,
        Instant cutoffAt,
        Instant createdAt,
        String poolStatus,
        /** False while the pool is open: the price is today's price and can still drop. */
        boolean priceIsFinal
) {
}
