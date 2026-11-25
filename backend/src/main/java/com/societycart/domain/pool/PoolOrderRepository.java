package com.societycart.domain.pool;

import java.math.BigDecimal;
import org.springframework.data.domain.Pageable;
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

    interface StatusTotal {
        PoolOrder.OrderStatus getStatus();
        long getOrders();
        BigDecimal getSavings();
    }

    @Query("""
            select o.status as status, count(o) as orders, sum(greatest(0.0, p.basePrice - coalesce(o.finalSettledUnitPrice, o.initialUnitPrice)) * o.quantity) as savings
            from PoolOrder o join o.poolWindow p where o.resident.id = :residentId group by o.status
            """)
    List<StatusTotal> totalsByStatus(UUID residentId);

    @Query("""
            select o from PoolOrder o join fetch o.poolWindow
            where o.resident.id = :residentId and o.status in :statuses
            order by o.createdAt desc, o.id desc
            """)
    List<PoolOrder> history(UUID residentId, Collection<PoolOrder.OrderStatus> statuses,
                            Pageable pageable);

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
