package com.societycart.domain.pool;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PoolRepository extends JpaRepository<PoolWindow, UUID> {

    List<PoolWindow> findBySocietyId(UUID societyId);

    List<PoolWindow> findBySocietyIdAndStatus(UUID societyId, PoolWindow.PoolStatus status);

    /** Open, not-yet-expired pools for the resident dashboard (tiers fetched in the same query). */
    @Query("""
            SELECT DISTINCT p FROM PoolWindow p LEFT JOIN FETCH p.priceTiers
            WHERE p.society.id = :societyId AND p.status = :status AND p.endTime > :now
            ORDER BY p.endTime ASC
            """)
    List<PoolWindow> findActivePoolsForSociety(@Param("societyId") UUID societyId,
                                               @Param("now") Instant now,
                                               @Param("status") PoolWindow.PoolStatus status);

    /** Every pool of a society, any status, newest first (admin screen). */
    @Query("""
            SELECT DISTINCT p FROM PoolWindow p LEFT JOIN FETCH p.priceTiers
            WHERE p.society.id = :societyId
            ORDER BY p.createdAt DESC
            """)
    List<PoolWindow> findAllForSociety(@Param("societyId") UUID societyId);

    @Query("SELECT p FROM PoolWindow p WHERE p.status = :status AND p.endTime <= :cutoff")
    List<PoolWindow> findExpiredPoolWindows(
            @Param("status") PoolWindow.PoolStatus status,
            @Param("cutoff") Instant cutoff
    );

    @Query("SELECT DISTINCT p FROM PoolWindow p LEFT JOIN FETCH p.priceTiers WHERE p.id = :id")
    Optional<PoolWindow> findByIdWithTiers(@Param("id") UUID id);

    /**
     * Row lock for every state change (join, cancel, close, dispatch). Serialises writers per pool so the
     * aggregate quantity and tier price can never be lost-updated by two residents joining at once.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM PoolWindow p WHERE p.id = :id")
    Optional<PoolWindow> findByIdForUpdate(@Param("id") UUID id);

    boolean existsBySocietyIdAndProductIdAndStatus(UUID societyId, String productId, PoolWindow.PoolStatus status);
}
