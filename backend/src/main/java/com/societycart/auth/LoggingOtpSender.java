package com.societycart.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/**
 * Development sender: prints the code to the console instead of sending an SMS.
 * Not available under the {@code prod} profile, so production startup fails loudly until a real
 * {@link OtpSender} bean is provided (this prevents OTPs from ever being written to production logs).
 */
@Component
@Profile("!prod")
public class LoggingOtpSender implements OtpSender {

    private static final Logger log = LoggerFactory.getLogger(LoggingOtpSender.class);

    @Override
    public void send(String phone, String code) {
        log.warn("[DEV OTP] code for ******{} is {}", phone.substring(Math.max(0, phone.length() - 4)), code);
    }
}
