package com.societycart.domain.pool;

import com.societycart.common.ApiExceptions.ConflictException;
import com.societycart.common.ApiExceptions.ForbiddenException;
import com.societycart.domain.fulfillment.PurchaseOrderService;
import com.societycart.domain.product.Product;
import com.societycart.domain.product.ProductRepository;
import com.societycart.domain.resident.Resident;
import com.societycart.domain.society.Society;
import com.societycart.domain.society.SocietyRepository;
import com.societycart.dto.AdminCreatePoolRequest;
import com.societycart.dto.PackingListView;
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
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PoolServiceTest {

    private static final Instant NOW = Instant.parse("2026-11-10T10:00:00Z");

    @Mock
    private PoolRepository poolRepository;
    @Mock
    private PoolOrderRepository poolOrderRepository;
    @Mock
    private SocietyRepository societyRepository;
    @Mock
    private ProductRepository productRepository;
    @Mock
    private PoolBroadcaster broadcaster;
    @Mock
    private PurchaseOrderService purchaseOrderService;

    private final PricingEngine pricingEngine = new PricingEngine();
    private PoolService service;

    private Society society;
    private Resident shopkeeper;
    private Resident admin;
    private Resident resident;
    private PoolWindow pool;

    @BeforeEach
    void setUp() {
        service = new PoolService(poolRepository, poolOrderRepository, societyRepository, productRepository, pricingEngine,
                new ViewMapper(pricingEngine), broadcaster, purchaseOrderService, Clock.fixed(NOW, ZoneOffset.UTC));

        society = new Society(UUID.randomUUID(), "Greenwood Heights", "GWH-01", "1 Park Rd", "Bengaluru",
                "Karnataka", "560001", 12.9, 77.6, 500.0, "Gate 2", true);
        shopkeeper = new Resident(UUID.randomUUID(), society, "9000000009", "Shopkeeper", "S1", Resident.Role.SHOPKEEPER);
        admin = new Resident(UUID.randomUUID(), society, "9000000001", "Admin", "A-1", Resident.Role.SOCIETY_ADMIN);
        resident = new Resident(UUID.randomUUID(), society, "9000000002", "Res", "B-2", Resident.Role.RESIDENT);

        pool = new PoolWindow();
        pool.setId(UUID.randomUUID());
        pool.setSociety(society);
        pool.setProductId("SKU-OIL");
        pool.setProductName("Oil 1L");
        pool.setBasePrice(new BigDecimal("200.00"));
        pool.setCurrentUnitPrice(new BigDecimal("190.00"));
        pool.setCurrentTotalQuantity(12);
        pool.setStatus(PoolWindow.PoolStatus.OPEN);
        pool.setEndTime(NOW.plusSeconds(3600));
        pool.addPriceTier(new PriceTier(1, 10, new BigDecimal("5.00"), new BigDecimal("190.00"), "10+"));

        when(poolRepository.findByIdForUpdate(pool.getId())).thenReturn(Optional.of(pool));
        when(poolRepository.findByIdWithTiers(pool.getId())).thenReturn(Optional.of(pool));
        when(poolRepository.save(any(PoolWindow.class))).thenAnswer(inv -> inv.getArgument(0));
        when(societyRepository.findById(society.getId())).thenReturn(Optional.of(society));
        Product milk = new Product(UUID.randomUUID(), society, "SKU-MILK", "Milk 1L", "https://img.example/milk.png", "Dairy", "L", new BigDecimal("200"));
        when(productRepository.findBySocietyIdAndSku(society.getId(), "SKU-MILK")).thenReturn(Optional.of(milk));
    }

    private PoolOrder confirmedOrder() {
        PoolOrder o = new PoolOrder();
        o.setId(UUID.randomUUID());
        o.setQuantity(4);
        o.setInitialUnitPrice(new BigDecimal("200.00"));
        o.setTotalPaid(new BigDecimal("800.00"));
        o.setStatus(PoolOrder.OrderStatus.CONFIRMED);
        pool.addOrder(o);
        return o;
    }

    // ---------------------------------------------------------------- lock (close)

    @Test
    @DisplayName("Closing a pool locks it, settles every order at the final price, and broadcasts")
    void lockSettlesOrders() {
        PoolOrder order = confirmedOrder();

        PoolView view = service.lockPool(pool.getId(), admin);

        assertEquals(PoolWindow.PoolStatus.LOCKED, pool.getStatus());
        assertEquals(PoolOrder.OrderStatus.SETTLED, order.getStatus());
        assertEquals(new BigDecimal("190.00"), order.getFinalSettledUnitPrice());
        assertEquals("LOCKED", view.status());
        verify(broadcaster).poolUpdated(any(PoolView.class));
        verify(broadcaster).statusChanged(eq(pool.getId()), eq(society.getId()), eq("LOCKED"), any());
        verify(purchaseOrderService, never()).generateAndDispatchPurchaseOrder(any());
    }

    @Test
    @DisplayName("Closing a pool nobody joined cancels it instead of settling nothing")
    void lockEmptyPoolCancels() {
        pool.setCurrentTotalQuantity(0);
        service.lockPool(pool.getId(), admin);
        assertEquals(PoolWindow.PoolStatus.CANCELLED, pool.getStatus());
    }

    @Test
    @DisplayName("Only an open pool can be closed")
    void lockRequiresOpen() {
        pool.setStatus(PoolWindow.PoolStatus.LOCKED);
        assertThrows(IllegalStateException.class, () -> service.lockPool(pool.getId(), admin));
    }

    // ---------------------------------------------------------------- dispatch

    @Test
    @DisplayName("Dispatch sends the PO once, stamps the time and moves orders along")
    void dispatchSendsPurchaseOrder() {
        PoolOrder order = confirmedOrder();
        service.lockPool(pool.getId(), admin);

        assertThrows(IllegalStateException.class, () -> service.dispatchPool(pool.getId(), shopkeeper));
        pool.setEndTime(NOW);
        service.dispatchPool(pool.getId(), shopkeeper);

        verify(purchaseOrderService, times(1)).generateAndDispatchPurchaseOrder(pool);
        assertEquals(PoolWindow.PoolStatus.DISPATCHED, pool.getStatus());
        assertEquals(NOW, pool.getDispatchedAt());
        assertEquals(PoolOrder.OrderStatus.DISPATCHED, order.getStatus());
    }

    @Test
    @DisplayName("A pool that is still open cannot be dispatched")
    void dispatchRequiresLocked() {
        assertThrows(IllegalStateException.class, () -> service.dispatchPool(pool.getId(), shopkeeper));
        verify(purchaseOrderService, never()).generateAndDispatchPurchaseOrder(any());
    }

    @Test
    @DisplayName("Dispatching twice is refused, so the supplier is never ordered twice")
    void dispatchTwiceRefused() {
        confirmedOrder();
        service.lockPool(pool.getId(), admin);
        assertThrows(IllegalStateException.class, () -> service.dispatchPool(pool.getId(), shopkeeper));
        pool.setEndTime(NOW);
        service.dispatchPool(pool.getId(), shopkeeper);

        assertThrows(IllegalStateException.class, () -> service.dispatchPool(pool.getId(), shopkeeper));
        verify(purchaseOrderService, times(1)).generateAndDispatchPurchaseOrder(any());
    }

    @Test
    @DisplayName("Marking delivered completes the pool and its orders")
    void markDelivered() {
        PoolOrder order = confirmedOrder();
        service.lockPool(pool.getId(), admin);
        assertThrows(IllegalStateException.class, () -> service.dispatchPool(pool.getId(), shopkeeper));
        pool.setEndTime(NOW);
        service.dispatchPool(pool.getId(), shopkeeper);

        service.markDelivered(pool.getId(), admin);

        assertEquals(PoolWindow.PoolStatus.COMPLETED, pool.getStatus());
        assertEquals(PoolOrder.OrderStatus.DELIVERED, order.getStatus());
    }

    // ---------------------------------------------------------------- authorisation

    @Test
    @DisplayName("A plain resident cannot close or dispatch")
    void residentForbidden() {
        assertThrows(ForbiddenException.class, () -> service.lockPool(pool.getId(), resident));
        assertThrows(ForbiddenException.class, () -> service.dispatchPool(pool.getId(), resident));
        assertEquals(PoolWindow.PoolStatus.OPEN, pool.getStatus());
    }

    @Test
    @DisplayName("An admin of another society cannot touch this society's pool")
    void otherSocietyAdminForbidden() {
        Society other = new Society(UUID.randomUUID(), "Other", "OTH-01", "x", "y", "z", "1", 1.0, 1.0, 1.0, "g", true);
        Resident foreignAdmin = new Resident(UUID.randomUUID(), other, "9000000003", "FA", "A-1", Resident.Role.SOCIETY_ADMIN);

        assertThrows(ForbiddenException.class, () -> service.lockPool(pool.getId(), foreignAdmin));
        assertThrows(ForbiddenException.class, () -> service.getAdminView(pool.getId(), foreignAdmin));
        assertThrows(ForbiddenException.class, () -> service.listForAdmin(society.getId(), foreignAdmin));
    }

    @Test
    @DisplayName("A platform admin may manage any society")
    void platformAdminAllowed() {
        Society other = new Society(UUID.randomUUID(), "Other", "OTH-01", "x", "y", "z", "1", 1.0, 1.0, 1.0, "g", true);
        Resident platform = new Resident(UUID.randomUUID(), other, "9000000004", "P", "A-1", Resident.Role.PLATFORM_ADMIN);
        assertDoesNotThrowOn(() -> service.getAdminView(pool.getId(), platform));
    }

    private static void assertDoesNotThrowOn(Runnable r) {
        r.run();
    }

    @Test
    @DisplayName("Residents of other societies cannot read this pool")
    void poolHiddenFromOtherSociety() {
        Society other = new Society(UUID.randomUUID(), "Other", "OTH-01", "x", "y", "z", "1", 1.0, 1.0, 1.0, "g", true);
        Resident outsider = new Resident(UUID.randomUUID(), other, "9000000005", "O", "A-1", Resident.Role.RESIDENT);
        assertThrows(java.util.NoSuchElementException.class, () -> service.getPoolView(pool.getId(), outsider));
        assertThrows(java.util.NoSuchElementException.class, () -> service.getOpenPoolViews(society.getId(), outsider));
    }

    // ---------------------------------------------------------------- scheduler

    @Test
    @DisplayName("The scheduler only locks pools whose cut-off has really passed, and is idempotent")
    void lockExpiredPool() {
        assertFalse(service.lockExpiredPool(pool.getId()), "cut-off is in the future");
        assertEquals(PoolWindow.PoolStatus.OPEN, pool.getStatus());

        pool.setEndTime(NOW.minusSeconds(1));
        confirmedOrder();
        assertTrue(service.lockExpiredPool(pool.getId()));
        assertEquals(PoolWindow.PoolStatus.LOCKED, pool.getStatus());

        assertFalse(service.lockExpiredPool(pool.getId()), "second instance finds it already locked");
    }

    // ---------------------------------------------------------------- create

    private AdminCreatePoolRequest createRequest(Instant cutoff, String base, String floor, String sku) {
        return new AdminCreatePoolRequest(society.getId(), sku, new BigDecimal(base), new BigDecimal(floor), cutoff,
                List.of(new AdminCreatePoolRequest.TierInput(20, new BigDecimal("28")),
                        new AdminCreatePoolRequest.TierInput(10, new BigDecimal("10"))),
                15);
    }

    @Test
    @DisplayName("Creating a pool prices tiers from discounts, sorts them, and applies the admin's limits")
    void createPoolSuccess() {
        when(poolRepository.save(any(PoolWindow.class))).thenAnswer(inv -> inv.getArgument(0));

        PoolView view = service.createPool(createRequest(NOW.plusSeconds(7200), "200", "120", "SKU-MILK"), admin);

        ArgumentCaptor<PoolWindow> saved = ArgumentCaptor.forClass(PoolWindow.class);
        verify(poolRepository).save(saved.capture());
        PoolWindow p = saved.getValue();
        assertEquals("SKU-MILK", p.getProductId());
        assertEquals("Milk 1L", p.getProductName(), "name comes from the catalog");
        assertEquals("https://img.example/milk.png", p.getImageUrl(), "photo comes from the catalog");
        assertEquals("Dairy", p.getCategory());
        assertEquals("L", p.getUnit());
        assertEquals(PoolWindow.PoolStatus.OPEN, p.getStatus());
        assertEquals(15, p.getMaxQuantityPerOrder());
        assertEquals(new BigDecimal("120"), p.getFloorPrice());
        assertEquals(2, p.getPriceTiers().size());
        assertEquals(new BigDecimal("180.00"), p.getPriceTiers().get(0).getUnitPrice(), "10 units -> 10% off");
        assertEquals(new BigDecimal("144.00"), p.getPriceTiers().get(1).getUnitPrice(), "20 units -> 28% off");
        assertEquals(20, p.getTargetVolumeThreshold());
        assertEquals(0, view.aggregateQuantity());
        verify(broadcaster).poolUpdated(view);
    }

    @Test
    @DisplayName("Creation rejects a past cut-off, a floor above the base price and a duplicate open product")
    void createPoolValidation() {
        assertThrows(IllegalArgumentException.class,
                () -> service.createPool(createRequest(NOW.plusSeconds(60), "200", "120", "SKU-MILK"), admin));
        assertThrows(IllegalArgumentException.class,
                () -> service.createPool(createRequest(NOW.plusSeconds(7200), "200", "250", "SKU-MILK"), admin));

        when(poolRepository.existsBySocietyIdAndProductIdAndStatusAndEndTimeAfter(
                society.getId(), "SKU-MILK", PoolWindow.PoolStatus.OPEN, NOW)).thenReturn(true);
        assertThrows(ConflictException.class,
                () -> service.createPool(createRequest(NOW.plusSeconds(7200), "200", "120", "SKU-MILK"), admin));
        verify(poolRepository, never()).save(any(PoolWindow.class));
    }
    @Test
    @DisplayName("Only deals that are still running block a new deal for the same product (an expired one does not)")
    void createPoolIgnoresExpiredDeals() {
        service.createPool(createRequest(NOW.plusSeconds(7200), "200", "120", "SKU-MILK"), admin);

        // The duplicate check is asked about deals closing after "now", so an expired-but-not-yet-locked deal is ignored.
        verify(poolRepository).existsBySocietyIdAndProductIdAndStatusAndEndTimeAfter(
                society.getId(), "SKU-MILK", PoolWindow.PoolStatus.OPEN, NOW);
        verify(poolRepository).save(any(PoolWindow.class));
    }

    @Test
    @DisplayName("A resident cannot create pools")
    void createPoolForbiddenForResident() {
        assertThrows(ForbiddenException.class,
                () -> service.createPool(createRequest(NOW.plusSeconds(7200), "200", "120", "SKU-MILK"), resident));
    }

    @Test
    @DisplayName("A deal can only be opened for a product that is in the society's active catalog")
    void createPoolNeedsCatalogProduct() {
        assertThrows(IllegalArgumentException.class,
                () -> service.createPool(createRequest(NOW.plusSeconds(7200), "200", "120", "SKU-UNKNOWN"), admin));

        Product archived = new Product(UUID.randomUUID(), society, "SKU-OLD", "Old", null, null, null, new BigDecimal("50"));
        archived.setActive(false);
        when(productRepository.findBySocietyIdAndSku(society.getId(), "SKU-OLD")).thenReturn(Optional.of(archived));
        IllegalArgumentException e = assertThrows(IllegalArgumentException.class,
                () -> service.createPool(createRequest(NOW.plusSeconds(7200), "200", "120", "SKU-OLD"), admin));
        assertTrue(e.getMessage().contains("product list"));
        verify(poolRepository, never()).save(any(PoolWindow.class));
    }

    // ---------------------------------------------------------------- change closing time

    @Test
    @DisplayName("Admin can extend an open deal's closing time; residents see it live")
    void updateCutoffExtends() {
        Instant later = NOW.plusSeconds(3 * 86400);

        PoolView view = service.updateCutoff(pool.getId(), later, admin);

        assertEquals(later, pool.getEndTime());
        assertEquals(later, view.cutoffAt());
        verify(broadcaster).poolUpdated(any(PoolView.class));
    }

    @Test
    @DisplayName("The new closing time must be at least 5 minutes away and within 30 days")
    void updateCutoffBounds() {
        assertThrows(IllegalArgumentException.class, () -> service.updateCutoff(pool.getId(), NOW.plusSeconds(120), admin));
        assertThrows(IllegalArgumentException.class, () -> service.updateCutoff(pool.getId(), NOW.minusSeconds(60), admin));
        assertThrows(IllegalArgumentException.class, () -> service.updateCutoff(pool.getId(), NOW.plusSeconds(31L * 86400), admin));
        assertEquals(NOW.plusSeconds(3600), pool.getEndTime(), "rejected changes leave the time untouched");
    }

    @Test
    @DisplayName("Only open deals can change time, and only by an admin of that society")
    void updateCutoffGuards() {
        assertThrows(ForbiddenException.class, () -> service.updateCutoff(pool.getId(), NOW.plusSeconds(7200), resident));

        pool.setStatus(PoolWindow.PoolStatus.LOCKED);
        assertThrows(IllegalStateException.class, () -> service.updateCutoff(pool.getId(), NOW.plusSeconds(7200), admin));
    }

    // ---------------------------------------------------------------- cancel a deal

    @Test
    @DisplayName("Cancelling an open deal cancels every order with it and tells residents")
    void cancelOpenPool() {
        PoolOrder a = confirmedOrder();
        PoolOrder b = confirmedOrder();

        PoolView view = service.cancelPool(pool.getId(), admin);

        assertEquals(PoolWindow.PoolStatus.CANCELLED, pool.getStatus());
        assertEquals(PoolOrder.OrderStatus.CANCELLED, a.getStatus());
        assertEquals(PoolOrder.OrderStatus.CANCELLED, b.getStatus());
        assertEquals("CANCELLED", view.status());
        verify(broadcaster).statusChanged(eq(pool.getId()), eq(society.getId()), eq("CANCELLED"), any());
    }

    @Test
    @DisplayName("A closed (locked) deal can still be cancelled before dispatch, but not after")
    void cancelLockedButNotDispatched() {
        confirmedOrder();
        service.lockPool(pool.getId(), admin);
        service.cancelPool(pool.getId(), admin);
        assertEquals(PoolWindow.PoolStatus.CANCELLED, pool.getStatus());

        pool.setStatus(PoolWindow.PoolStatus.DISPATCHED);
        assertThrows(IllegalStateException.class, () -> service.cancelPool(pool.getId(), admin));
    }

    @Test
    @DisplayName("Residents and admins of other societies cannot cancel a deal")
    void cancelGuards() {
        Society other = new Society(UUID.randomUUID(), "Other", "OTH-01", "x", "y", "z", "1", 1.0, 1.0, 1.0, "g", true);
        Resident foreignAdmin = new Resident(UUID.randomUUID(), other, "9000000009", "FA", "A-1", Resident.Role.SOCIETY_ADMIN);
        assertThrows(ForbiddenException.class, () -> service.cancelPool(pool.getId(), resident));
        assertThrows(ForbiddenException.class, () -> service.cancelPool(pool.getId(), foreignAdmin));
        assertEquals(PoolWindow.PoolStatus.OPEN, pool.getStatus());
    }

    // ---------------------------------------------------------------- packing list

    private PoolOrder packingOrder(String flat, String name, int qty, PoolOrder.OrderStatus status) {
        PoolOrder o = new PoolOrder();
        o.setId(UUID.randomUUID());
        o.setPoolWindow(pool);
        o.setFlatNumber(flat);
        o.setResidentName(name);
        o.setPhoneNumber("9876500000");
        o.setQuantity(qty);
        o.setInitialUnitPrice(new BigDecimal("200.00"));
        o.setStatus(status);
        return o;
    }

    @Test
    @DisplayName("Packing list is flat-ordered naturally, skips cancelled orders and totals units and money")
    void packingListContents() {
        // Open pool at 190 (12 units, 10+ tier): open orders show today's price; settled ones show their final price.
        PoolOrder settled = packingOrder("A-1", "One", 3, PoolOrder.OrderStatus.SETTLED);
        settled.setFinalSettledUnitPrice(new BigDecimal("190.00"));
        when(poolOrderRepository.findByPoolWindowId(pool.getId())).thenReturn(List.of(
                packingOrder("B-10", "Ten", 2, PoolOrder.OrderStatus.CONFIRMED),
                packingOrder("B-2", "Two", 1, PoolOrder.OrderStatus.CONFIRMED),
                settled,
                packingOrder("C-1", "Gone", 9, PoolOrder.OrderStatus.CANCELLED)));

        PackingListView view = service.packingList(pool.getId(), admin);

        assertEquals(List.of("A-1", "B-2", "B-10"), view.lines().stream().map(PackingListView.Line::flatNumber).toList());
        assertEquals(6, view.totalUnits(), "cancelled units are not counted");
        assertEquals(new BigDecimal("1140.00"), view.totalAmount());
        assertEquals("SKU-OIL", view.sku());
        assertEquals(new BigDecimal("570.00"), view.lines().get(0).amount());
    }

    @Test
    @DisplayName("Packing list is admin-only and scoped to the admin's society")
    void packingListGuards() {
        Society other = new Society(UUID.randomUUID(), "Other", "OTH-01", "x", "y", "z", "1", 1.0, 1.0, 1.0, "g", true);
        Resident foreignAdmin = new Resident(UUID.randomUUID(), other, "9000000009", "FA", "A-1", Resident.Role.SOCIETY_ADMIN);
        assertThrows(ForbiddenException.class, () -> service.packingList(pool.getId(), resident));
        assertThrows(ForbiddenException.class, () -> service.packingList(pool.getId(), foreignAdmin));
    }
}
