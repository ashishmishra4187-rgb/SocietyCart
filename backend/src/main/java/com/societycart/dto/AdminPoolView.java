package com.societycart.dto;

import com.fasterxml.jackson.annotation.JsonUnwrapped;

import java.time.Instant;

/** Pool plus the supplier purchase-order preview, for the society admin dispatch screen. */
public record AdminPoolView(
        @JsonUnwrapped PoolView pool,
        SupplierPoSummary supplierPOPayload,
        Instant dispatchedAt
) {
    public record SupplierPoSummary(
            String societyName,
            String deliveryAddress,
            String sku,
            int totalQuantity,
            java.math.BigDecimal agreedUnitPrice,
            String requiredBy,
            Instant dispatchedAt
    ) {
    }
}
