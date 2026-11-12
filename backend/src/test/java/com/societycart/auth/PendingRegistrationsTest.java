package com.societycart.auth;

import com.societycart.common.ApiExceptions.TooManyRequestsException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class PendingRegistrationsTest {

    static class MutableClock extends Clock {
        private Instant now = Instant.parse("2026-11-10T10:00:00Z");

        void advance(Duration d) {
            now = now.plus(d);
        }

        @Override
        public java.time.ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }

    private MutableClock clock;
    private PendingRegistrations pending;
    private final UUID society = UUID.randomUUID();

    private PendingRegistrations.Registration reg(String name) {
        return new PendingRegistrations.Registration(name, society, "B-1204", "RESIDENT");
    }

    @BeforeEach
    void setUp() {
        clock = new MutableClock();
        pending = new PendingRegistrations(clock, Duration.ofMinutes(5), 3);
    }

    @Test
    @DisplayName("Details are held until taken, and can be taken only once")
    void takeOnce() {
        pending.put("9876543210", reg("Asha Rao"));
        assertEquals("Asha Rao", pending.take("9876543210").orElseThrow().name());
        assertFalse(pending.take("9876543210").isPresent(), "single use");
    }

    @Test
    @DisplayName("Unknown phone has nothing pending")
    void unknownPhone() {
        assertFalse(pending.take("9123456780").isPresent());
    }

    @Test
    @DisplayName("Details expire with the OTP window")
    void expires() {
        pending.put("9876543210", reg("Asha Rao"));
        clock.advance(Duration.ofMinutes(5).plusSeconds(1));
        assertFalse(pending.take("9876543210").isPresent());
    }

    @Test
    @DisplayName("Signing up again replaces the earlier details (e.g. a corrected flat number)")
    void replaces() {
        pending.put("9876543210", reg("Asha Rao"));
        pending.put("9876543210", reg("Asha R Rao"));
        assertEquals("Asha R Rao", pending.take("9876543210").orElseThrow().name());
    }

    @Test
    @DisplayName("Memory is bounded: a flood of new numbers is refused, but expired entries are reclaimed")
    void boundedSize() {
        pending.put("9000000001", reg("A"));
        pending.put("9000000002", reg("B"));
        pending.put("9000000003", reg("C"));
        assertThrows(TooManyRequestsException.class, () -> pending.put("9000000004", reg("D")));
        pending.put("9000000003", reg("C2")); // replacing an existing number is still fine

        clock.advance(Duration.ofMinutes(6));
        pending.put("9000000004", reg("D")); // old ones purged
        assertEquals(1, pending.size());
    }

    @Test
    @DisplayName("Each phone's details stay separate")
    void separatePhones() {
        pending.put("9000000001", reg("A"));
        pending.put("9000000002", reg("B"));
        assertEquals("B", pending.take("9000000002").orElseThrow().name());
        assertEquals("A", pending.take("9000000001").orElseThrow().name());
    }
}
