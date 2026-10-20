package com.barberworkshop.api;

import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import java.time.LocalDate;
import java.util.List;
import static org.assertj.core.api.Assertions.*;

class SalesReportsTest {
    private ApiController.Order order(String date, double total, String product, int quantity, double unitPrice) {
        return new ApiController.Order("order", date, "Test salon", "", "", "Bekliyor", total,
                List.of(new ApiController.Line(product, quantity, unitPrice)), "");
    }

    @Test void dateSelectionChangesRevenueAndDailyBarsSumToTheRevenue() {
        var orders = List.of(order("19.10.2026 12:00", 150, "Wax", 3, 50), order("08.10.2026 12:00", 400, "Makas", 2, 200));
        var today = LocalDate.of(2026, 10, 20);
        var week = SalesReports.summarize(orders, 7, today);
        var month = SalesReports.summarize(orders, 30, today);
        assertThat(week.get("revenue")).isEqualTo(150.0);
        assertThat(week.get("orderCount")).isEqualTo(1);
        assertThat(month.get("revenue")).isEqualTo(550.0);
        assertThat(month.get("averageBasket")).isEqualTo(275.0);
        @SuppressWarnings("unchecked") var daily = (List<java.util.Map<String,Object>>)month.get("dailySales");
        assertThat(daily).hasSize(30);
        assertThat(daily.stream().mapToDouble(row -> ((Number)row.get("value")).doubleValue()).sum()).isEqualTo(550.0);
    }

    @Test void topProductsAreAggregatedFromOrderLinesInsteadOfCatalogueOrder() {
        var data = SalesReports.summarize(List.of(order("19.10.2026 12:00", 150, "Wax", 3, 50),
                order("18.10.2026 12:00", 200, "Wax", 4, 50), order("17.10.2026 12:00", 300, "Makas", 1, 300)), 7, LocalDate.of(2026,10,20));
        @SuppressWarnings("unchecked") var top = (List<SalesReports.ProductSales>)data.get("topProducts");
        assertThat(top.get(0).name()).isEqualTo("Wax");
        assertThat(top.get(0).quantity()).isEqualTo(7);
        assertThat(top.get(0).revenue()).isEqualTo(350.0);
    }

    @Test void futureAndInvalidDatesAreExcludedAndEmptyReportsStayFinite() {
        var data = SalesReports.summarize(List.of(order("21.10.2026 12:00", 150, "Wax", 3, 50),
                order("invalid", 400, "Makas", 2, 200)), 7, LocalDate.of(2026,10,20));
        assertThat(data.get("orderCount")).isEqualTo(0);
        assertThat(data.get("averageBasket")).isEqualTo(0.0);
        assertThatThrownBy(() -> SalesReports.summarize(List.of(), 1000, LocalDate.of(2026,10,20)))
                .isInstanceOf(ResponseStatusException.class);
    }
}
