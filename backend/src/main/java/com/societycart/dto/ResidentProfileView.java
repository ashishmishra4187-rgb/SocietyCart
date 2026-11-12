package com.societycart.dto;

import java.util.UUID;

public record ResidentProfileView(
        String name,
        String phone,
        String flatNumber,
        UUID societyId,
        String societyName,
        String joinCode
) {
}
