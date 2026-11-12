package com.societycart.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.UUID;

/** Add a product to a society's catalog. */
public record ProductRequest(
        @NotNull(message = "Society is required")
        UUID societyId,

        @NotBlank(message = "SKU is required")
        @Pattern(regexp = "^[A-Za-z0-9][A-Za-z0-9_-]{1,63}$", message = "SKU must be 2-64 letters, numbers, dashes or underscores")
        String sku,

        @NotBlank(message = "Product name is required")
        @Size(max = 255, message = "Name is too long")
        String name,

        @Pattern(regexp = "^$|^https?://\\S{4,490}$", message = "Image link must start with http:// or https://")
        String imageUrl,

        @Size(max = 100, message = "Category is too long")
        String category,

        @Size(max = 50, message = "Unit is too long")
        String unit,

        @NotNull(message = "Usual price is required")
        @DecimalMin(value = "0.01", message = "Price must be positive")
        @DecimalMax(value = "1000000", message = "Price is too high")
        BigDecimal basePrice
) {
}
