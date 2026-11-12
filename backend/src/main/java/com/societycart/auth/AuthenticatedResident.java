package com.societycart.auth;

import java.io.Serializable;
import java.util.UUID;

/**
 * What we keep in the HTTP session for a signed-in user. Deliberately tiny and non-sensitive;
 * the full {@code Resident} is always re-read from the database when needed.
 */
public record AuthenticatedResident(UUID residentId, UUID societyId, String phone, String role) implements Serializable {
}
