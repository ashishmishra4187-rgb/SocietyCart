package com.societycart.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Consolidated Wholesale Purchase Order Payload sent to distributors/wholesalers
 * upon closing of a pooling batch window.
 */
public record SupplierPOPayload(
        String purchaseOrderNumber,
        UUID poolWindowId,
        UUID societyId,
        String societyName,
        String societyAddress,
        String deliveryGateNote,
        String productId,
        String productName,
        String category,
        String unit,
        Integer totalBulkUnits,
        BigDecimal wholesaleUnitCost,
        BigDecimal totalWholesaleAmount,
        Instant batchCutoffTime,
        LocalDate expectedDeliveryDate,
        List<ResidentDistributionSlip> packingSlips
) {
    public record ResidentDistributionSlip(
            String orderNumber,
            String flatNumber,
            String residentName,
            String phoneNumber,
            Integer quantity,
            BigDecimal settledUnitPrice,
            BigDecimal totalAmountPaid,
            BigDecimal communitySavingsEarned
    ) {
    }
}
