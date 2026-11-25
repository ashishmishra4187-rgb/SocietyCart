package com.societycart.domain.pool;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
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
import org.springframework.data.jpa.repository.Modifying;

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

    @Query("select p.id from PoolWindow p where p.society.id = :societyId order by p.createdAt desc, p.id desc")
    Page<UUID> historyIds(UUID societyId, Pageable pageable);

    @Query("select distinct p from PoolWindow p left join fetch p.priceTiers where p.id in :ids order by p.createdAt desc, p.id desc")
    List<PoolWindow> historyWithTiers(List<UUID> ids);

    @Query("select p.id from PoolWindow p where p.status = :status and p.endTime <= :now order by p.id")
    List<UUID> expiredIds(PoolWindow.PoolStatus status, Instant now, Pageable pageable);

    @Query("select p.id from PoolWindow p where p.status = :status and p.endTime <= :now and p.id > :after order by p.id")
    List<UUID> expiredIdsAfter(PoolWindow.PoolStatus status, Instant now, UUID after, Pageable pageable);

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
    /**
     * Is there a deal for this product that is still running? A deal whose closing time has passed is effectively
     * closed even if the scheduler has not locked it yet, so it must not block opening a new one.
     */
    boolean existsBySocietyIdAndProductIdAndStatusAndEndTimeAfter(UUID societyId, String productId, PoolWindow.PoolStatus status, Instant endTime);
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("UPDATE PoolWindow p SET p.imageUrl = :imageUrl WHERE p.society.id = :societyId AND p.productId = :sku")
    int updateImageForProduct(@Param("societyId") UUID societyId, @Param("sku") String sku, @Param("imageUrl") String imageUrl);
}
