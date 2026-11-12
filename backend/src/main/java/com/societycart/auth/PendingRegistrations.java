package com.societycart.auth;

import com.societycart.common.ApiExceptions.TooManyRequestsException;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Sign-up details waiting for the phone to be proven with an OTP. The account is only created once the
 * code is verified, so nobody can reserve or pollute an account for a number they do not control.
 *
 * In memory with a short TTL and a hard size cap (single-instance, like {@link OtpService}).
 */
public class PendingRegistrations {

    public record Registration(String name, UUID societyId, String flatNumber, String role) {
    }

    private record Entry(Registration registration, Instant expiresAt) {
    }

    private final Clock clock;
    private final Duration ttl;
    private final int maxEntries;
    private final Map<String, Entry> pending = new ConcurrentHashMap<>();

    public PendingRegistrations(Clock clock, Duration ttl, int maxEntries) {
        this.clock = clock;
        this.ttl = ttl;
        this.maxEntries = maxEntries;
    }

    /** Stores (or replaces) the pending sign-up for a phone. */
    public void put(String phone, Registration registration) {
        Instant now = clock.instant();
        pending.entrySet().removeIf(e -> now.isAfter(e.getValue().expiresAt()));
        if (pending.size() >= maxEntries && !pending.containsKey(phone)) {
            throw new TooManyRequestsException("Too many sign-ups in progress. Please try again shortly.", 60);
        }
        pending.put(phone, new Entry(registration, now.plus(ttl)));
    }

    /** Removes and returns the pending sign-up, if it exists and has not expired. */
    public Optional<Registration> take(String phone) {
        Entry entry = pending.remove(phone);
        if (entry == null || clock.instant().isAfter(entry.expiresAt())) {
            return Optional.empty();
        }
        return Optional.of(entry.registration());
    }

    public int size() {
        return pending.size();
    }
}
