package com.barberworkshop.api;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;

final class SalesReports {
    private static final DateTimeFormatter ORDER_DATE = DateTimeFormatter.ofPattern("dd.MM.uuuu HH:mm").withResolverStyle(java.time.format.ResolverStyle.STRICT);
    private SalesReports() { }

    static Map<String, Object> summarize(List<ApiController.Order> orders, int days, LocalDate today) {
        if (days < 1 || days > 90) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Dönem 1 ile 90 gün arasında olmalı.");
        LocalDate start = today.minusDays(days - 1L);
        Map<LocalDate, Double> salesByDay = new LinkedHashMap<>();
        for (LocalDate date = start; !date.isAfter(today); date = date.plusDays(1)) salesByDay.put(date, 0.0);
        List<ApiController.Order> selected = new ArrayList<>();
        for (var order : orders) {
            try {
                LocalDate date = LocalDateTime.parse(order.date(), ORDER_DATE).toLocalDate();
                if (salesByDay.containsKey(date)) {
                    selected.add(order);
                    salesByDay.compute(date, (key, value) -> value + order.total());
                }
            } catch (DateTimeParseException ignored) { /* Invalid historical dates cannot enter a dated report. */ }
        }
        double revenue = selected.stream().mapToDouble(ApiController.Order::total).sum();
        Map<String, ProductSales> byProduct = new LinkedHashMap<>();
        for (var order : selected) for (var line : order.lines()) {
            var previous = byProduct.getOrDefault(line.name(), new ProductSales(line.name(), 0, 0));
            byProduct.put(line.name(), new ProductSales(line.name(), previous.quantity + line.quantity(),
                    previous.revenue + line.quantity() * line.unitPrice()));
        }
        List<Map<String, Object>> daily = salesByDay.entrySet().stream().map(entry -> Map.<String, Object>of(
                "date", entry.getKey().toString(), "label", entry.getKey().format(DateTimeFormatter.ofPattern("dd.MM")),
                "value", entry.getValue())).toList();
        return Map.of("days", days, "revenue", revenue, "orderCount", selected.size(),
                "averageBasket", selected.isEmpty() ? 0.0 : revenue / selected.size(), "dailySales", daily,
                "topProducts", byProduct.values().stream().sorted(Comparator.comparingDouble(ProductSales::revenue).reversed()).limit(3).toList());
    }
    record ProductSales(String name, int quantity, double revenue) { }
}
