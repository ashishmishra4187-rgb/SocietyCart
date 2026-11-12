package com.societycart.domain.pool;

import com.societycart.common.ApiExceptions.ConflictException;
import com.societycart.domain.resident.Resident;
import com.societycart.domain.society.Society;
import com.societycart.dto.JoinPoolRequest;
import com.societycart.dto.PoolView;
import com.societycart.web.PoolBroadcaster;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PoolOrderServiceTest {

    @Mock
    private PoolRepository poolRepository;
    @Mock
    private PoolOrderRepository poolOrderRepository;
    @Mock
    private PoolBroadcaster broadcaster;

    private final PricingEngine pricingEngine = new PricingEngine();
    private PoolOrderService service;

    private Society society;
    private Resident resident;
    private PoolWindow pool;

    @BeforeEach
    void setUp() {
        service = new PoolOrderService(poolRepository, poolOrderRepository, pricingEngine, new ViewMapper(pricingEngine), broadcaster);

        society = new Society(UUID.randomUUID(), "Greenwood Heights", "GWH-01", "1 Park Rd", "Bengaluru",
                "Karnataka", "560001", 12.9, 77.6, 500.0, "Gate 2", true);
        resident = new Resident(UUID.randomUUID(), society, "9876543210", "Asha", "B-1204", Resident.Role.RESIDENT);

        pool = new PoolWindow();
        pool.setId(UUID.randomUUID());
        pool.setSociety(society);
        pool.setProductId("SKU-ATTA");
        pool.setProductName("Atta 5kg");
        pool.setBasePrice(new BigDecimal("200.00"));
        pool.setCurrentUnitPrice(new BigDecimal("200.00"));
        pool.setCurrentTotalQuantity(0);
        pool.setMaxQuantityPerOrder(20);
        pool.setStatus(PoolWindow.PoolStatus.OPEN);
        pool.setStartTime(Instant.now().minusSeconds(60));
        pool.setEndTime(Instant.now().plusSeconds(3600));
        pool.addPriceTier(new PriceTier(1, 10, new BigDecimal("5.00"), new BigDecimal("190.00"), "10+"));
        pool.addPriceTier(new PriceTier(2, 20, new BigDecimal("10.00"), new BigDecimal("180.00"), "20+"));

        when(poolRepository.findByIdForUpdate(pool.getId())).thenReturn(Optional.of(pool));
        when(poolRepository.save(any(PoolWindow.class))).thenAnswer(inv -> inv.getArgument(0));
        when(poolOrderRepository.save(any(PoolOrder.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private static JoinPoolRequest request(String sku, int qty) {
        return new JoinPoolRequest("B-1204", List.of(new JoinPoolRequest.Item(sku, qty)));
    }

    @Test
    @DisplayName("Joining records an order at the quoted price, grows the pool and broadcasts once")
    void joinCreatesOrderAndUpdatesPool() {
        PoolView view = service.join(pool.getId(), resident, request("SKU-ATTA", 4), "key-1");

        ArgumentCaptor<PoolOrder> saved = ArgumentCaptor.forClass(PoolOrder.class);
        verify(poolOrderRepository).save(saved.capture());
        PoolOrder order = saved.getValue();
        assertEquals(4, order.getQuantity());
        assertEquals(new BigDecimal("200.00"), order.getInitialUnitPrice());
        assertEquals(new BigDecimal("800.00"), order.getTotalPaid());
        assertEquals(PoolOrder.OrderStatus.CONFIRMED, order.getStatus());
        assertSame(resident, order.getResident());
        assertEquals("key-1", order.getIdempotencyKey());
        assertEquals("B-1204", order.getFlatNumber());
        assertEquals("9876543210", order.getPhoneNumber());
        assertEquals(1, order.getItems().size());

        assertEquals(4, view.aggregateQuantity());
        assertEquals(4, pool.getCurrentTotalQuantity());
        verify(broadcaster).poolUpdated(view);
    }

    @Test
    @DisplayName("Crossing a tier threshold drops the pool price for everyone")
    void joinCrossingTierDropsPrice() {
        pool.setCurrentTotalQuantity(8);

        PoolView view = service.join(pool.getId(), resident, request("SKU-ATTA", 3), null);

        assertEquals(11, view.aggregateQuantity());
        assertEquals(new BigDecimal("190.00"), view.currentUnitPrice());
        assertEquals(new BigDecimal("190.00"), pool.getCurrentUnitPrice());
        ArgumentCaptor<PoolOrder> saved = ArgumentCaptor.forClass(PoolOrder.class);
        verify(poolOrderRepository).save(saved.capture());
        assertEquals(new BigDecimal("200.00"), saved.getValue().getInitialUnitPrice(), "quoted at the price in force when joining");
    }

    @Test
    @DisplayName("Joining always takes the row lock first")
    void joinUsesRowLock() {
        service.join(pool.getId(), resident, request("SKU-ATTA", 1), null);
        verify(poolRepository).findByIdForUpdate(pool.getId());
    }

    @Test
    @DisplayName("Joining twice is a 409 and creates nothing")
    void rejectsDuplicateJoin() {
        when(poolOrderRepository.existsByPoolWindowIdAndResidentIdAndStatusNot(
                pool.getId(), resident.getId(), PoolOrder.OrderStatus.CANCELLED)).thenReturn(true);

        ConflictException e = assertThrows(ConflictException.class,
                () -> service.join(pool.getId(), resident, request("SKU-ATTA", 1), null));
        assertTrue(e.getMessage().contains("already joined"));
        verify(poolOrderRepository, never()).save(any(PoolOrder.class));
    }

    @Test
    @DisplayName("A closed or expired pool refuses new orders")
    void rejectsClosedPool() {
        pool.setEndTime(Instant.now().minusSeconds(5));
        assertThrows(ConflictException.class, () -> service.join(pool.getId(), resident, request("SKU-ATTA", 1), null));

        pool.setEndTime(Instant.now().plusSeconds(3600));
        pool.setStatus(PoolWindow.PoolStatus.LOCKED);
        assertThrows(ConflictException.class, () -> service.join(pool.getId(), resident, request("SKU-ATTA", 1), null));
        verify(poolOrderRepository, never()).save(any(PoolOrder.class));
    }

    @Test
    @DisplayName("Quantity above the pool's per-order cap is rejected")
    void rejectsOverMaxQuantity() {
        pool.setMaxQuantityPerOrder(5);
        IllegalArgumentException e = assertThrows(IllegalArgumentException.class,
                () -> service.join(pool.getId(), resident, request("SKU-ATTA", 6), null));
        assertTrue(e.getMessage().contains("at most 5"));
    }

    @Test
    @DisplayName("Ordering a SKU that is not this pool's product is rejected (the pool id is not a SKU)")
    void rejectsWrongSku() {
        assertThrows(IllegalArgumentException.class,
                () -> service.join(pool.getId(), resident, request(pool.getId().toString(), 1), null));
        verify(poolOrderRepository, never()).save(any(PoolOrder.class));
    }

    @Test
    @DisplayName("Retrying with the same Idempotency-Key does not create a second order")
    void idempotentReplay() {
        pool.setCurrentTotalQuantity(4);
        when(poolOrderRepository.findByResidentIdAndIdempotencyKey(resident.getId(), "key-1"))
                .thenReturn(Optional.of(new PoolOrder()));

        PoolView view = service.join(pool.getId(), resident, request("SKU-ATTA", 4), "key-1");

        assertEquals(4, view.aggregateQuantity(), "quantity must not be applied twice");
        verify(poolOrderRepository, never()).save(any(PoolOrder.class));
        verify(broadcaster, never()).poolUpdated(any());
    }

    @Test
    @DisplayName("A pool of another society looks like it does not exist")
    void otherSocietyCannotJoin() {
        Society other = new Society(UUID.randomUUID(), "Other", "OTH-01", "x", "y", "z", "1", 1.0, 1.0, 1.0, "g", true);
        Resident outsider = new Resident(UUID.randomUUID(), other, "9123456780", "Out", "A-1", Resident.Role.RESIDENT);

        assertThrows(NoSuchElementException.class, () -> service.join(pool.getId(), outsider, request("SKU-ATTA", 1), null));
        verify(poolOrderRepository, never()).save(any(PoolOrder.class));
    }

    @Test
    @DisplayName("An over-long Idempotency-Key is rejected")
    void rejectsHugeKey() {
        assertThrows(IllegalArgumentException.class,
                () -> service.join(pool.getId(), resident, request("SKU-ATTA", 1), "x".repeat(101)));
    }

    @Test
    @DisplayName("Cancelling an open order returns the units and restores the earlier price")
    void cancelRestoresQuantityAndPrice() {
        pool.setCurrentTotalQuantity(11);
        pool.setCurrentUnitPrice(new BigDecimal("190.00"));
        PoolOrder order = ownedOrder(3, PoolOrder.OrderStatus.CONFIRMED);
        when(poolOrderRepository.findOwned(order.getId(), resident.getId())).thenReturn(Optional.of(order));

        PoolView view = service.cancel(pool.getId(), order.getId(), resident);

        assertEquals(PoolOrder.OrderStatus.CANCELLED, order.getStatus());
        assertEquals(8, view.aggregateQuantity());
        assertEquals(new BigDecimal("200.00"), view.currentUnitPrice());
        verify(broadcaster).poolUpdated(view);
    }

    @Test
    @DisplayName("A settled order can no longer be cancelled")
    void cancelRefusedAfterSettlement() {
        PoolOrder order = ownedOrder(3, PoolOrder.OrderStatus.SETTLED);
        when(poolOrderRepository.findOwned(order.getId(), resident.getId())).thenReturn(Optional.of(order));

        assertThrows(ConflictException.class, () -> service.cancel(pool.getId(), order.getId(), resident));
        assertEquals(PoolOrder.OrderStatus.SETTLED, order.getStatus());
    }

    @Test
    @DisplayName("Cancelling someone else's order looks like a 404")
    void cancelOthersOrderNotFound() {
        when(poolOrderRepository.findOwned(any(UUID.class), eq(resident.getId()))).thenReturn(Optional.empty());
        assertThrows(NoSuchElementException.class, () -> service.cancel(pool.getId(), UUID.randomUUID(), resident));
    }

    private PoolOrder ownedOrder(int qty, PoolOrder.OrderStatus status) {
        PoolOrder order = new PoolOrder();
        order.setId(UUID.randomUUID());
        order.setPoolWindow(pool);
        order.setResident(resident);
        order.setQuantity(qty);
        order.setInitialUnitPrice(new BigDecimal("200.00"));
        order.setStatus(status);
        return order;
    }
}
