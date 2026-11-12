package com.societycart.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

/** Partial update: only the fields that are sent are changed. The SKU can never change. */
public record ProductUpdateRequest(
        @Size(min = 1, max = 255, message = "Name must be 1-255 characters")
        String name,

        @Pattern(regexp = "^$|^https?://\\S{4,490}$", message = "Image link must start with http:// or https://")
        String imageUrl,

        @Size(max = 100, message = "Category is too long")
        String category,

        @Size(max = 50, message = "Unit is too long")
        String unit,

        @DecimalMin(value = "0.01", message = "Price must be positive")
        @DecimalMax(value = "1000000", message = "Price is too high")
        BigDecimal basePrice,

        Boolean active
) {
}
