package com.societycart.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/** Who gets how many units, flat by flat, for handing out the goods once the pool has closed. */
public record PackingListView(
        UUID poolWindowId,
        String productName,
        String sku,
        String unit,
        int totalUnits,
        BigDecimal totalAmount,
        List<Line> lines
) {
    public record Line(
            String flatNumber,
            String residentName,
            String phone,
            int quantity,
            BigDecimal unitPrice,
            BigDecimal amount,
            String status
    ) {
    }
}
