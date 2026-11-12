package com.societycart.dto;

import com.fasterxml.jackson.annotation.JsonUnwrapped;

public record OrderDetailView(
        @JsonUnwrapped OrderView order,
        String orderNumber,
        String flatNumber,
        PoolView pool
) {
}
