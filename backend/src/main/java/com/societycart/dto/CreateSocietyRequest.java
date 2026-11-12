package com.societycart.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CreateSocietyRequest(
        @NotBlank(message = "Society name is required")
        String name,

        @NotBlank(message = "Society code is required")
        String societyCode,

        @NotBlank(message = "Address line is required")
        String addressLine,

        @NotBlank(message = "City is required")
        String city,

        @NotBlank(message = "State is required")
        String state,

        @NotBlank(message = "Postal code is required")
        String postalCode,

        @NotNull(message = "Latitude is required")
        Double latitude,

        @NotNull(message = "Longitude is required")
        Double longitude,

        Double geofenceRadiusMeters,

        String deliveryGateNote
) {
}
