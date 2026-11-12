package com.societycart.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.converter.DefaultContentTypeResolver;
import org.springframework.messaging.converter.MappingJackson2MessageConverter;
import org.springframework.messaging.converter.MessageConverter;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.util.MimeTypeUtils;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

import java.util.List;

/**
 * Real-time STOMP WebSocket configuration for live pool volume and discount progress tracking.
 * The browser connects natively to {@code /ws} (same origin through the dev proxy) and subscribes to
 * {@code /topic/pools/{poolId}}.
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final ObjectMapper objectMapper;
    private final String[] allowedOrigins;

    public WebSocketConfig(ObjectMapper objectMapper,
                           @Value("${societycart.cors.allowed-origins:http://localhost:5173}") List<String> allowedOrigins) {
        this.objectMapper = objectMapper;
        this.allowedOrigins = allowedOrigins.toArray(new String[0]);
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // The simple broker only sends heartbeats when it has a scheduler.
        ThreadPoolTaskScheduler heartbeat = new ThreadPoolTaskScheduler();
        heartbeat.setPoolSize(1);
        heartbeat.setThreadNamePrefix("ws-heartbeat-");
        heartbeat.setDaemon(true);
        heartbeat.initialize();

        config.enableSimpleBroker("/topic")
                .setHeartbeatValue(new long[]{10_000, 10_000})
                .setTaskScheduler(heartbeat);
        config.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // Only the configured web origins may open a socket (no wildcard). Session cookie authenticates the handshake.
        registry.addEndpoint("/ws").setAllowedOrigins(allowedOrigins);
    }

    /**
     * Use the application's ObjectMapper so STOMP frames serialise exactly like REST responses.
     * The messaging default writes Instants as numeric timestamps, which the web app would reject.
     */
    @Override
    public boolean configureMessageConverters(List<MessageConverter> messageConverters) {
        DefaultContentTypeResolver resolver = new DefaultContentTypeResolver();
        resolver.setDefaultMimeType(MimeTypeUtils.APPLICATION_JSON);
        MappingJackson2MessageConverter converter = new MappingJackson2MessageConverter();
        converter.setObjectMapper(objectMapper);
        converter.setContentTypeResolver(resolver);
        messageConverters.add(converter);
        return false;
    }
}
