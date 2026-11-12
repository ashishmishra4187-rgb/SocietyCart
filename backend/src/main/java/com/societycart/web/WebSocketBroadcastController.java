package com.societycart.web;

import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;

import java.util.Map;

/**
 * Client-initiated STOMP messages. Server-initiated pushes live in {@link PoolBroadcaster}.
 */
@Controller
public class WebSocketBroadcastController {

    /** Responds to client ping/heartbeat checks. */
    @MessageMapping("/pool/{poolId}/ping")
    @SendTo("/topic/pool/{poolId}/pong")
    public Map<String, Object> handlePing(@DestinationVariable String poolId) {
        return Map.of(
                "poolId", poolId,
                "status", "CONNECTED",
                "timestamp", System.currentTimeMillis()
        );
    }
}
