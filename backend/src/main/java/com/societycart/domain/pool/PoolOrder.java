package com.societycart.domain.pool;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.societycart.domain.resident.Resident;
import jakarta.persistence.*;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/**
 * An individual resident's order participating in a collective pool window.
 */
@Entity
@Table(name = "pool_orders", indexes = {
        @Index(name = "idx_pool_orders_window", columnList = "pool_window_id"),
        @Index(name = "idx_pool_orders_email", columnList = "residentEmail"),
        @Index(name = "idx_pool_orders_status", columnList = "status")
})
public class PoolOrder {

    public enum OrderStatus {
        PENDING,
        CONFIRMED,
        SETTLED,
        DISPATCHED,
        DELIVERED,
        CANCELLED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "pool_window_id", nullable = false)
    private PoolWindow poolWindow;

    @NotBlank
    @Column(nullable = false, unique = true, length = 100)
    private String orderNumber;

    @NotBlank(message = "Resident name is required")
    @Column(nullable = false)
    private String residentName;

    /** Optional: residents sign in by phone and may not have an email on file. */
    @Column
    private String residentEmail;

    /** Owner of the order. Null only for legacy/demo rows created before residents existed. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "resident_id")
    private Resident resident;

    /** Client-supplied key making "join" safe to retry (unique per resident). */
    @Column(length = 100)
    private String idempotencyKey;

    @NotBlank(message = "Phone number is required")
    @Column(nullable = false, length = 50)
    private String phoneNumber;

    @NotBlank(message = "Flat / Unit number is required")
    @Column(nullable = false, length = 100)
    private String flatNumber;

    @NotNull
    @Min(1)
    @Column(nullable = false)
    private Integer quantity;

    @NotNull
    @DecimalMin("0.01")
    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal initialUnitPrice;

    @Column(precision = 10, scale = 2)
    private BigDecimal finalSettledUnitPrice;

    @NotNull
    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal totalPaid;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal totalSavings = BigDecimal.ZERO;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private OrderStatus status = OrderStatus.CONFIRMED;

    @OneToMany(mappedBy = "poolOrder", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<PoolOrderItem> items = new ArrayList<>();

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    public PoolOrder() {
    }

    @PrePersist
    protected void onCreate() {
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
        if (this.id == null) {
            this.id = UUID.randomUUID();
        }
        if (this.orderNumber == null) {
            this.orderNumber = "SC-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12).toUpperCase();
        }
        if (this.totalPaid == null && this.initialUnitPrice != null && this.quantity != null) {
            this.totalPaid = this.initialUnitPrice.multiply(BigDecimal.valueOf(this.quantity));
        }
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = Instant.now();
    }

    public void addItem(PoolOrderItem item) {
        items.add(item);
        item.setPoolOrder(this);
    }

    // Getters and Setters
    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public PoolWindow getPoolWindow() {
        return poolWindow;
    }

    public void setPoolWindow(PoolWindow poolWindow) {
        this.poolWindow = poolWindow;
    }

    public String getOrderNumber() {
        return orderNumber;
    }

    public void setOrderNumber(String orderNumber) {
        this.orderNumber = orderNumber;
    }

    public String getResidentName() {
        return residentName;
    }

    public void setResidentName(String residentName) {
        this.residentName = residentName;
    }

    public String getResidentEmail() {
        return residentEmail;
    }

    public void setResidentEmail(String residentEmail) {
        this.residentEmail = residentEmail;
    }

    public Resident getResident() {
        return resident;
    }

    public void setResident(Resident resident) {
        this.resident = resident;
    }

    public String getIdempotencyKey() {
        return idempotencyKey;
    }

    public void setIdempotencyKey(String idempotencyKey) {
        this.idempotencyKey = idempotencyKey;
    }

    public String getPhoneNumber() {
        return phoneNumber;
    }

    public void setPhoneNumber(String phoneNumber) {
        this.phoneNumber = phoneNumber;
    }

    public String getFlatNumber() {
        return flatNumber;
    }

    public void setFlatNumber(String flatNumber) {
        this.flatNumber = flatNumber;
    }

    public Integer getQuantity() {
        return quantity;
    }

    public void setQuantity(Integer quantity) {
        this.quantity = quantity;
    }

    public BigDecimal getInitialUnitPrice() {
        return initialUnitPrice;
    }

    public void setInitialUnitPrice(BigDecimal initialUnitPrice) {
        this.initialUnitPrice = initialUnitPrice;
    }

    public BigDecimal getFinalSettledUnitPrice() {
        return finalSettledUnitPrice;
    }

    public void setFinalSettledUnitPrice(BigDecimal finalSettledUnitPrice) {
        this.finalSettledUnitPrice = finalSettledUnitPrice;
    }

    public BigDecimal getTotalPaid() {
        return totalPaid;
    }

    public void setTotalPaid(BigDecimal totalPaid) {
        this.totalPaid = totalPaid;
    }

    public BigDecimal getTotalSavings() {
        return totalSavings;
    }

    public void setTotalSavings(BigDecimal totalSavings) {
        this.totalSavings = totalSavings;
    }

    public OrderStatus getStatus() {
        return status;
    }

    public void setStatus(OrderStatus status) {
        this.status = status;
    }

    public List<PoolOrderItem> getItems() {
        return items;
    }

    public void setItems(List<PoolOrderItem> items) {
        this.items = items;
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
        PoolOrder poolOrder = (PoolOrder) o;
        return Objects.equals(id, poolOrder.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }
}
