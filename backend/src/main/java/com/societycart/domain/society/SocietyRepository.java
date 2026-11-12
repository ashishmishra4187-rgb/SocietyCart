package com.societycart.domain.society;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SocietyRepository extends JpaRepository<Society, UUID> {

    Optional<Society> findBySocietyCode(String societyCode);

    List<Society> findByActiveTrue();

    /**
     * Finds active societies within a specific radius (in meters) from a geographic coordinate
     * using the Great-Circle Haversine distance formula.
     */
    @Query(value = """
            SELECT s.*, 
                   (6371000 * acos(
                       LEAST(1.0, GREATEST(-1.0,
                           cos(radians(:latitude)) * cos(radians(s.latitude)) * cos(radians(s.longitude) - radians(:longitude)) 
                           + sin(radians(:latitude)) * sin(radians(s.latitude))
                       ))
                   )) AS distance_meters
            FROM societies s
            WHERE s.active = true
              AND (6371000 * acos(
                       LEAST(1.0, GREATEST(-1.0,
                           cos(radians(:latitude)) * cos(radians(s.latitude)) * cos(radians(s.longitude) - radians(:longitude)) 
                           + sin(radians(:latitude)) * sin(radians(s.latitude))
                       ))
                   )) <= :radiusMeters
            ORDER BY distance_meters ASC
            """, nativeQuery = true)
    List<Society> findNearbySocieties(
            @Param("latitude") Double latitude,
            @Param("longitude") Double longitude,
            @Param("radiusMeters") Double radiusMeters
    );
}
