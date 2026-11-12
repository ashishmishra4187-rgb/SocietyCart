package com.societycart.domain.pool;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PoolOrderRepository extends JpaRepository<PoolOrder, UUID> {

    List<PoolOrder> findByPoolWindowId(UUID poolWindowId);

    List<PoolOrder> findByResidentEmailOrderByCreatedAtDesc(String residentEmail);

    Optional<PoolOrder> findByOrderNumber(String orderNumber);

    Optional<PoolOrder> findByResidentIdAndIdempotencyKey(UUID residentId, String idempotencyKey);

    boolean existsByPoolWindowIdAndResidentIdAndStatusNot(UUID poolWindowId, UUID residentId, PoolOrder.OrderStatus status);

    /** Order with its pool and tiers, only if it belongs to the resident. */
    @Query("""
            SELECT o FROM PoolOrder o JOIN FETCH o.poolWindow p JOIN FETCH p.society
            WHERE o.id = :id AND o.resident.id = :residentId
            """)
    Optional<PoolOrder> findOwned(@Param("id") UUID id, @Param("residentId") UUID residentId);

    @Query("""
            SELECT o FROM PoolOrder o JOIN FETCH o.poolWindow p JOIN FETCH p.society
            WHERE o.resident.id = :residentId
            ORDER BY o.createdAt DESC
            """)
    List<PoolOrder> findAllForResident(@Param("residentId") UUID residentId);

    /** Participants per pool in one query (cancelled orders excluded): rows of [poolId, count]. */
    @Query("""
            SELECT o.poolWindow.id, COUNT(o) FROM PoolOrder o
            WHERE o.poolWindow.id IN :poolIds AND o.status <> :excluded
            GROUP BY o.poolWindow.id
            """)
    List<Object[]> countByPool(@Param("poolIds") Collection<UUID> poolIds,
                               @Param("excluded") PoolOrder.OrderStatus excluded);

    long countByPoolWindowIdAndStatusNot(UUID poolWindowId, PoolOrder.OrderStatus excluded);
}
