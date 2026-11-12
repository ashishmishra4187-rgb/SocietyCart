package com.societycart.web;

import com.societycart.dto.PoolView;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.Map;
import java.util.UUID;

/**
 * Publishes live pool updates over STOMP.
 *
 * Messages are sent only AFTER the surrounding transaction commits. Otherwise a client could receive an
 * update (and refetch) before the data is visible, or be told about a change that later rolled back.
 */
@Component
public class PoolBroadcaster {

    private static final Logger log = LoggerFactory.getLogger(PoolBroadcaster.class);

    private final SimpMessagingTemplate messagingTemplate;

    public PoolBroadcaster(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    public void poolUpdated(PoolView view) {
        if (view == null) return;
        afterCommit(() -> {
            messagingTemplate.convertAndSend("/topic/pools/" + view.poolWindowId(), view);
            messagingTemplate.convertAndSend("/topic/societies/" + view.societyId() + "/pools", view);
            log.debug("Broadcast pool {}: {} units @ {}", view.poolWindowId(), view.aggregateQuantity(), view.currentUnitPrice());
        });
    }

    public void statusChanged(UUID poolId, UUID societyId, String status, String message) {
        afterCommit(() -> messagingTemplate.convertAndSend("/topic/pools/" + poolId + "/status", Map.of(
                "poolId", poolId.toString(),
                "societyId", societyId.toString(),
                "status", status,
                "message", message,
                "timestamp", System.currentTimeMillis()
        )));
    }

    private void afterCommit(Runnable action) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    safely(action);
                }
            });
        } else {
            safely(action);
        }
    }

    private void safely(Runnable action) {
        try {
            action.run();
        } catch (RuntimeException e) {
            // A failed push must never fail (or roll back) the business operation.
            log.warn("WebSocket broadcast failed: {}", e.getMessage());
        }
    }
}
