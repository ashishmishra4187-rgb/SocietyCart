package com.societycart.domain.pool;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.societycart.domain.society.Society;
import jakarta.persistence.*;
import org.hibernate.annotations.BatchSize;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/**
 * Represents a demand aggregation pooling window for a specific residential society and product.
 * Aggregates individual orders into bulk wholesale orders over a batching cycle (e.g., 24h).
 */
@Entity
@Table(name = "pool_windows", indexes = {
        @Index(name = "idx_pool_windows_society_id", columnList = "society_id"),
        @Index(name = "idx_pool_windows_status", columnList = "status"),
        @Index(name = "idx_pool_windows_end_time", columnList = "endTime")
})
public class PoolWindow {

    public enum PoolStatus {
        OPEN,
        LOCKED,
        BATCHING,
        DISPATCHED,
        COMPLETED,
        CANCELLED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "society_id", nullable = false)
    private Society society;

    @NotBlank(message = "Product ID / SKU is required")
    @Column(nullable = false, length = 100)
    private String productId;

    @NotBlank(message = "Product name is required")
    @Column(nullable = false)
    private String productName;

    @Column(columnDefinition = "TEXT")
    private String productDescription;

    @NotBlank(message = "Category is required")
    @Column(nullable = false, length = 100)
    private String category;

    @NotBlank(message = "Unit is required")
    @Column(nullable = false, length = 50)
    private String unit;

    @Column(length = 500)
    private String imageUrl;

    @NotNull(message = "Base price (MSRP) is required")
    @DecimalMin("0.01")
    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal basePrice;

    @NotNull(message = "Current unit price is required")
    @DecimalMin("0.01")
    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal currentUnitPrice;

    /** Lowest price an admin allows any tier to reach (validated at creation). */
    @Column(precision = 10, scale = 2)
    private BigDecimal floorPrice;

    @NotNull
    @Min(1)
    @Column(nullable = false)
    private Integer maxQuantityPerOrder = 20;

    @NotNull
    @Min(0)
    @Column(nullable = false)
    private Integer currentTotalQuantity = 0;

    @NotNull
    @Min(1)
    @Column(nullable = false)
    private Integer targetVolumeThreshold = 50;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private PoolStatus status = PoolStatus.OPEN;

    @NotNull
    @Column(nullable = false)
    private Instant startTime;

    @NotNull
    @Column(nullable = false)
    private Instant endTime;

    private LocalDate expectedDeliveryDate;

    private Instant dispatchedAt;

    @Version
    @Column(nullable = false)
    private Long version = 0L;

    // BatchSize turns the "one tier query per pool" N+1 on list screens into one query per 50 pools.
    @BatchSize(size = 50)
    @OneToMany(mappedBy = "poolWindow", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @OrderBy("minQuantity ASC")
    private List<PriceTier> priceTiers = new ArrayList<>();

    @JsonIgnore
    @OneToMany(mappedBy = "poolWindow", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<PoolOrder> orders = new ArrayList<>();

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    public PoolWindow() {
    }

    @PrePersist
    protected void onCreate() {
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
        if (this.id == null) {
            this.id = UUID.randomUUID();
        }
        if (this.currentUnitPrice == null && this.basePrice != null) {
            this.currentUnitPrice = this.basePrice;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = Instant.now();
    }

    public void addPriceTier(PriceTier tier) {
        priceTiers.add(tier);
        tier.setPoolWindow(this);
    }

    public void removePriceTier(PriceTier tier) {
        priceTiers.remove(tier);
        tier.setPoolWindow(null);
    }

    public void addOrder(PoolOrder order) {
        orders.add(order);
        order.setPoolWindow(this);
    }

    public boolean isOpen() {
        return this.status == PoolStatus.OPEN && Instant.now().isBefore(this.endTime);
    }

    // Getters and Setters
    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public Society getSociety() {
        return society;
    }

    public void setSociety(Society society) {
        this.society = society;
    }

    public String getProductId() {
        return productId;
    }

    public void setProductId(String productId) {
        this.productId = productId;
    }

    public String getProductName() {
        return productName;
    }

    public void setProductName(String productName) {
        this.productName = productName;
    }

    public String getProductDescription() {
        return productDescription;
    }

    public void setProductDescription(String productDescription) {
        this.productDescription = productDescription;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getUnit() {
        return unit;
    }

    public void setUnit(String unit) {
        this.unit = unit;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public void setImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
    }

    public BigDecimal getBasePrice() {
        return basePrice;
    }

    public void setBasePrice(BigDecimal basePrice) {
        this.basePrice = basePrice;
    }

    public BigDecimal getCurrentUnitPrice() {
        return currentUnitPrice;
    }

    public void setCurrentUnitPrice(BigDecimal currentUnitPrice) {
        this.currentUnitPrice = currentUnitPrice;
    }

    public BigDecimal getFloorPrice() {
        return floorPrice;
    }

    public void setFloorPrice(BigDecimal floorPrice) {
        this.floorPrice = floorPrice;
    }

    public Integer getMaxQuantityPerOrder() {
        return maxQuantityPerOrder;
    }

    public void setMaxQuantityPerOrder(Integer maxQuantityPerOrder) {
        this.maxQuantityPerOrder = maxQuantityPerOrder;
    }

    public Instant getDispatchedAt() {
        return dispatchedAt;
    }

    public void setDispatchedAt(Instant dispatchedAt) {
        this.dispatchedAt = dispatchedAt;
    }

    public Integer getCurrentTotalQuantity() {
        return currentTotalQuantity;
    }

    public void setCurrentTotalQuantity(Integer currentTotalQuantity) {
        this.currentTotalQuantity = currentTotalQuantity;
    }

    public Integer getTargetVolumeThreshold() {
        return targetVolumeThreshold;
    }

    public void setTargetVolumeThreshold(Integer targetVolumeThreshold) {
        this.targetVolumeThreshold = targetVolumeThreshold;
    }

    public PoolStatus getStatus() {
        return status;
    }

    public void setStatus(PoolStatus status) {
        this.status = status;
    }

    public Instant getStartTime() {
        return startTime;
    }

    public void setStartTime(Instant startTime) {
        this.startTime = startTime;
    }

    public Instant getEndTime() {
        return endTime;
    }

    public void setEndTime(Instant endTime) {
        this.endTime = endTime;
    }

    public LocalDate getExpectedDeliveryDate() {
        return expectedDeliveryDate;
    }

    public void setExpectedDeliveryDate(LocalDate expectedDeliveryDate) {
        this.expectedDeliveryDate = expectedDeliveryDate;
    }

    public Long getVersion() {
        return version;
    }

    public void setVersion(Long version) {
        this.version = version;
    }

    public List<PriceTier> getPriceTiers() {
        return priceTiers;
    }

    public void setPriceTiers(List<PriceTier> priceTiers) {
        this.priceTiers = priceTiers;
    }

    public List<PoolOrder> getOrders() {
        return orders;
    }

    public void setOrders(List<PoolOrder> orders) {
        this.orders = orders;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        PoolWindow that = (PoolWindow) o;
        return Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }
}
