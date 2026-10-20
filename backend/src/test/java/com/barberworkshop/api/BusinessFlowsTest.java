package com.barberworkshop.api;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import java.util.Map;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class BusinessFlowsTest {
    private MockMvc client;
    @BeforeEach void setup() {
        var auth = mock(SupabaseAuthService.class);
        when(auth.verify("Bearer test-user")).thenReturn(new SupabaseAuthService.VerifiedUser("test-user", "test@example.invalid", Map.of("companyName", "Test")));
        client = MockMvcBuilders.standaloneSetup(new ApiController(auth)).setControllerAdvice(new ApiErrors()).build();
    }

    @Test void productCanBeCreatedEditedAndTakenOffline() throws Exception {
        var result = client.perform(post("/api/products").header("Authorization","Bearer test-user").contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Test product\",\"category\":\"Test\",\"sku\":\"QA-1\",\"price\":12.5,\"stock\":3,\"description\":\"Example\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.price").value(12.5)).andReturn();
        String id = new com.fasterxml.jackson.databind.ObjectMapper().readTree(result.getResponse().getContentAsString()).get("id").asText();
        client.perform(put("/api/products/"+id).header("Authorization","Bearer test-user").contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Edited product\",\"category\":\"Test\",\"sku\":\"QA-1\",\"price\":20,\"stock\":7}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.stock").value(7));
        client.perform(patch("/api/products/"+id+"/active").header("Authorization","Bearer test-user").contentType(MediaType.APPLICATION_JSON).content("{\"active\":false}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.active").value(false));
    }

    @Test void invalidNumbersDoNotSilentlyBecomeZeroOrFractionalStock() throws Exception {
        for (String numbers : new String[]{"\"price\":\"NaN\",\"stock\":3", "\"price\":10,\"stock\":2.5", "\"price\":-1,\"stock\":3"}) {
            client.perform(post("/api/products").header("Authorization","Bearer test-user").contentType(MediaType.APPLICATION_JSON)
                    .content("{\"name\":\"Test\",\"category\":\"Test\",\"sku\":\"QA\","+numbers+"}"))
                    .andExpect(status().isBadRequest());
        }
    }

    @Test void campaignStoresSelectedProductScopeAndNoteAndRejectsNegativeBudget() throws Exception {
        client.perform(post("/api/ads").header("Authorization","Bearer test-user").contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"QA campaign\",\"productId\":\"p2\",\"scope\":\"Tek ürün\",\"budget\":150,\"note\":\"Chosen preview note\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.productId").value("p2")).andExpect(jsonPath("$.note").value("Chosen preview note"));
        client.perform(get("/api/ads").header("Authorization","Bearer test-user"))
                .andExpect(jsonPath("$[0].note").value("Chosen preview note"));
        client.perform(post("/api/ads").header("Authorization","Bearer test-user").contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Bad budget\",\"productId\":\"p2\",\"scope\":\"Tek ürün\",\"budget\":-10}"))
                .andExpect(status().isBadRequest());
    }

    @Test void nullProfileValueIsAValidationErrorInsteadOfServerFailure() throws Exception {
        client.perform(put("/api/profile").header("Authorization","Bearer test-user").contentType(MediaType.APPLICATION_JSON)
                .content("{\"companyName\":null}")).andExpect(status().isBadRequest());
    }

    @Test void inactiveProductsCannotBePromoted() throws Exception {
        client.perform(patch("/api/products/p1/active").header("Authorization","Bearer test-user").contentType(MediaType.APPLICATION_JSON)
                .content("{\"active\":false}")).andExpect(status().isOk());
        client.perform(post("/api/ads").header("Authorization","Bearer test-user").contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Invalid promotion\",\"productId\":\"p1\",\"scope\":\"Tek ürün\",\"budget\":150}"))
                .andExpect(status().isBadRequest());
    }

    @Test void reportsAreSerializedWithTheSelectedRangeAndCalculatedProductTotals() throws Exception {
        client.perform(get("/api/reports?days=90").header("Authorization","Bearer test-user"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.days").value(90))
                .andExpect(jsonPath("$.dailySales.length()").value(90))
                .andExpect(jsonPath("$.dailySales[0].date").isString())
                .andExpect(jsonPath("$.topProducts").isArray());
    }
}
