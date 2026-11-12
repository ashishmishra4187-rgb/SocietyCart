package com.societycart.domain.fulfillment;

import com.societycart.domain.pool.PoolOrder;
import com.societycart.domain.pool.PoolWindow;
import com.societycart.dto.SupplierPOPayload;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Wholesale & Supplier Integration Service.
 * Automatically forwards consolidated batch orders directly to local wholesalers or distributors,
 * eliminating retail middlemen and reducing last-mile delivery overhead.
 */
@Service
public class PurchaseOrderService {

    private static final Logger log = LoggerFactory.getLogger(PurchaseOrderService.class);

    /**
     * Generates a wholesale purchase order payload and forwards it to the wholesale supplier.
     */
    @Transactional
    public SupplierPOPayload generateAndDispatchPurchaseOrder(PoolWindow poolWindow) {
        log.info("Generating wholesale Purchase Order for Pool Window {} (Society: {}, Product: {})",
                poolWindow.getId(), poolWindow.getSociety().getName(), poolWindow.getProductName());

        int totalUnits = poolWindow.getCurrentTotalQuantity();
        BigDecimal wholesaleUnitCost = poolWindow.getCurrentUnitPrice();
        BigDecimal totalWholesaleAmount = wholesaleUnitCost.multiply(BigDecimal.valueOf(totalUnits));

        String poNumber = String.format("PO-%s-%s-%s",
                poolWindow.getSociety().getSocietyCode(),
                LocalDate.now().toString().replace("-", ""),
                UUID.randomUUID().toString().substring(0, 6).toUpperCase());

        List<SupplierPOPayload.ResidentDistributionSlip> distributionSlips = new ArrayList<>();
        if (poolWindow.getOrders() != null) {
            for (PoolOrder order : poolWindow.getOrders()) {
                if (order.getStatus() == PoolOrder.OrderStatus.CANCELLED) {
                    continue; // cancelled residents must never appear on a packing slip
                }
                BigDecimal unit = order.getFinalSettledUnitPrice() != null ? order.getFinalSettledUnitPrice() : wholesaleUnitCost;
                distributionSlips.add(new SupplierPOPayload.ResidentDistributionSlip(
                        order.getOrderNumber(),
                        order.getFlatNumber(),
                        order.getResidentName(),
                        order.getPhoneNumber(),
                        order.getQuantity(),
                        unit,
                        unit.multiply(BigDecimal.valueOf(order.getQuantity())),
                        order.getTotalSavings()
                ));
            }
        }

        SupplierPOPayload poPayload = new SupplierPOPayload(
                poNumber,
                poolWindow.getId(),
                poolWindow.getSociety().getId(),
                poolWindow.getSociety().getName(),
                poolWindow.getSociety().getAddressLine() + ", " + poolWindow.getSociety().getCity(),
                poolWindow.getSociety().getDeliveryGateNote(),
                poolWindow.getProductId(),
                poolWindow.getProductName(),
                poolWindow.getCategory(),
                poolWindow.getUnit(),
                totalUnits,
                wholesaleUnitCost.setScale(2, RoundingMode.HALF_UP),
                totalWholesaleAmount.setScale(2, RoundingMode.HALF_UP),
                Instant.now(),
                poolWindow.getExpectedDeliveryDate(),
                distributionSlips
        );

        // Forward to Supplier Integration (Simulating Wholesaler Gateway/EDI dispatch)
        dispatchToWholesalerChannel(poPayload);

        return poPayload;
    }

    private void dispatchToWholesalerChannel(SupplierPOPayload poPayload) {
        log.info("================================================================================");
        log.info("[WHOLESALE DISPATCH] Forwarding PO {} to Regional Distributor Hub", poPayload.purchaseOrderNumber());
        log.info("Destination Hub: {} ({})", poPayload.societyName(), poPayload.societyAddress());
        log.info("Delivery Note  : {}", poPayload.deliveryGateNote());
        log.info("Product        : {} x {} {}", poPayload.productName(), poPayload.totalBulkUnits(), poPayload.unit());
        log.info("Total Bulk Cost: ₹{}", poPayload.totalWholesaleAmount());
        log.info("Packing Slips  : {} individual flat distributions", poPayload.packingSlips().size());
        log.info("================================================================================");
    }
}
