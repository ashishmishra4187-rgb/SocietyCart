package com.societycart.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record ProductView(
        UUID id,
        UUID societyId,
        String sku,
        String name,
        String imageUrl,
        String category,
        String unit,
        BigDecimal basePrice,
        boolean active
) {
}
