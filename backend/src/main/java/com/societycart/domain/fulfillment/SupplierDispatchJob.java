package com.societycart.domain.fulfillment;

import org.springframework.data.domain.PageRequest;
import com.societycart.domain.pool.PoolRepository;
import com.societycart.domain.pool.PoolService;
import com.societycart.domain.pool.PoolWindow;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;

/**
 * Scheduled batching job that automatically monitors order cut-off windows.
 * When a pooling window reaches its end time, locks it and settles prices. The supplier purchase order is
 * sent by a society admin (or automatically when societycart.dispatch.auto-dispatch=true).
 */
@Component
public class SupplierDispatchJob {

    private static final Logger log = LoggerFactory.getLogger(SupplierDispatchJob.class);

    private final PoolRepository poolRepository;
    private final PoolService poolService;

    private final boolean autoDispatch;

    public SupplierDispatchJob(PoolRepository poolRepository,
                               PoolService poolService,
                               @Value("${societycart.dispatch.auto-dispatch:false}") boolean autoDispatch) {
        this.poolRepository = poolRepository;
        this.poolService = poolService;
        this.autoDispatch = autoDispatch;
    }

    /**
     * Periodic scanner for expired pool cut-off windows.
     * Configurable via societycart.scheduler.dispatch-rate-ms (default: 60s).
     */
    @Scheduled(fixedDelayString = "${societycart.scheduler.dispatch-rate-ms:60000}", initialDelay = 10000)
    public void scanAndDispatchBatchedPools() {
        Instant now = Instant.now();
        var batch = PageRequest.of(0, 100);
        var expiredWindows = poolRepository.expiredIds(PoolWindow.PoolStatus.OPEN, now, batch);
        while (!expiredWindows.isEmpty()) {
            for (var poolId : expiredWindows) {
                try {
                    // Locking is idempotent and row-locked, so several instances can run this safely.
                    boolean locked = poolService.lockExpiredPool(poolId);
                    if (locked && autoDispatch) {
                        poolService.dispatchSystem(poolId);
                    }
                } catch (Exception e) {
                    log.error("Failed to auto-settle pool window {}", poolId, e);
                }
            }
            if (expiredWindows.size() < batch.getPageSize()) break;
            expiredWindows = poolRepository.expiredIdsAfter(PoolWindow.PoolStatus.OPEN, now, expiredWindows.getLast(), batch);
        }
    }
}
