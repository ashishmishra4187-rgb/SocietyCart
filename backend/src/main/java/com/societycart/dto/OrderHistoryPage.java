package com.societycart.dto;

import java.math.BigDecimal;
import java.util.List;

public record OrderHistoryPage(List<OrderView> orders, long active, long past, BigDecimal saved) {}
