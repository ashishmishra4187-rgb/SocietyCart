package com.societycart.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * Resident joins a pool. Identity comes from the session, never from this body
 * (a {@code residentId} sent by older clients is ignored).
 */
public record JoinPoolRequest(
        @NotBlank(message = "Flat number is required")
        @Pattern(regexp = "^[A-Za-z0-9][A-Za-z0-9\\-/ ]{0,19}$", message = "Flat number may contain letters, numbers, dash or slash (max 20)")
        String flatNumber,

        @NotEmpty(message = "Add at least one item")
        @Size(max = 1, message = "Only one product per pool order")
        List<@Valid Item> items
) {
    public record Item(
            @NotBlank(message = "SKU is required") String sku,
            @NotNull @Min(value = 1, message = "Quantity must be at least 1") Integer quantity
    ) {
    }
}
