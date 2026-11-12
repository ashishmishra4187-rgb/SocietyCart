package com.societycart.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Society-admin request to open a pool for a product from the society's catalog (the name, photo, category and
 * unit come from the catalog, not from this request). Tier prices are computed server-side from discount percentages.
 */
public record AdminCreatePoolRequest(
        @NotNull(message = "Society is required")
        UUID societyId,

        @NotBlank(message = "SKU is required")
        @Pattern(regexp = "^[A-Za-z0-9][A-Za-z0-9_-]{1,63}$", message = "SKU must be 2-64 letters, numbers, dashes or underscores")
        String productSku,

        @NotNull(message = "Base price is required")
        @DecimalMin(value = "0.01", message = "Base price must be positive")
        BigDecimal basePrice,

        @NotNull(message = "Floor price is required")
        @DecimalMin(value = "0.01", message = "Floor price must be positive")
        BigDecimal floorPrice,

        @NotNull(message = "Closing time is required")
        Instant cutoffAt,

        @NotEmpty(message = "At least one discount tier is required")
        @Size(max = 8, message = "At most 8 tiers")
        List<@Valid TierInput> tiers,

        @Min(1) @Max(1000)
        Integer maxQuantityPerOrder
) {
    public record TierInput(
            @NotNull @Min(1) Integer minQuantity,
            @NotNull @DecimalMin("0.01") @DecimalMax("90") BigDecimal discountPercent
    ) {
    }
}
