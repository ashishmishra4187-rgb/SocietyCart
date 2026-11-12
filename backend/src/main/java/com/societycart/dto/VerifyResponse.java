package com.societycart.dto;

import java.util.UUID;

/** Returned on successful sign-in. The credential itself travels only in the httpOnly session cookie. */
public record VerifyResponse(UUID residentId, UUID societyId, String flatNumber, String role, String name, boolean newAccount) {
}
