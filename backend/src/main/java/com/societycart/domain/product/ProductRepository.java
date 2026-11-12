package com.societycart.domain.product;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ProductRepository extends JpaRepository<Product, UUID> {

    List<Product> findBySocietyIdOrderByNameAsc(UUID societyId);

    Optional<Product> findBySocietyIdAndSku(UUID societyId, String sku);

    boolean existsBySocietyIdAndSku(UUID societyId, String sku);
}
