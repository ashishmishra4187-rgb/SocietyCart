package com.societycart.auth;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;

import java.time.Clock;
import java.time.Duration;

@Configuration
public class AuthConfiguration {

    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }

    @Bean
    public OtpService otpService(Clock clock,
                                 Environment environment,
                                 @Value("${societycart.auth.otp-ttl:PT5M}") Duration ttl,
                                 @Value("${societycart.auth.otp-resend-cooldown:PT30S}") Duration cooldown,
                                 @Value("${societycart.auth.otp-max-attempts:5}") int maxAttempts,
                                 @Value("${societycart.auth.otp-max-sends-per-hour:5}") int maxSendsPerHour,
                                 @Value("${societycart.auth.fixed-otp:}") String fixedOtp) {
        if (fixedOtp != null && !fixedOtp.isBlank() && environment.acceptsProfiles(Profiles.of("prod"))) {
            throw new IllegalStateException("societycart.auth.fixed-otp must never be set under the 'prod' profile");
        }
        return new OtpService(clock, ttl, cooldown, maxAttempts, maxSendsPerHour, fixedOtp);
    }

    @Bean
    public PendingRegistrations pendingRegistrations(Clock clock,
                                                     Environment environment,
                                                     @Value("${societycart.auth.otp-ttl:PT5M}") Duration ttl,
                                                     @Value("${societycart.auth.admin-signup-code:}") String adminSignupCode) {
        if ("SOCIETY-ADMIN-DEMO".equals(adminSignupCode) && environment.acceptsProfiles(Profiles.of("prod"))) {
            throw new IllegalStateException("The demo admin sign-up code must never be used under the 'prod' profile");
        }
        return new PendingRegistrations(clock, ttl, 10_000);
    }
}
