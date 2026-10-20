package com.barberworkshop.api;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.client.RestClient;
import java.util.Map;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class ApiAuthenticationTest {
    private MockMvc mvc(SupabaseAuthService auth) {
        return MockMvcBuilders.standaloneSetup(new ApiController(auth)).setControllerAdvice(new ApiErrors()).build();
    }
    private SupabaseAuthService noConfiguration() { return new SupabaseAuthService("", "", RestClient.builder()); }

    @ParameterizedTest @ValueSource(strings={"/dashboard","/products","/orders","/orders/BT-20261008-01","/ads","/profile","/settlements","/reports","/auth/session"})
    void everyPrivateReadRequiresAuthentication(String path) throws Exception {
        mvc(noConfiguration()).perform(get("/api"+path)).andExpect(status().isUnauthorized());
    }

    @Test void privateWritesRequireAuthentication() throws Exception {
        var client = mvc(noConfiguration());
        client.perform(post("/api/products").contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isUnauthorized());
        client.perform(put("/api/products/p1").contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isUnauthorized());
        client.perform(patch("/api/products/p1/active").contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isUnauthorized());
        client.perform(post("/api/ads").contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isUnauthorized());
        client.perform(put("/api/profile").contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isUnauthorized());
        client.perform(put("/api/auth/password").contentType(MediaType.APPLICATION_JSON).content("{\"password\":\"passphrase\"}")).andExpect(status().isUnauthorized());
    }

    @Test void verifiedAccountsHaveSeparateData() throws Exception {
        var auth = mock(SupabaseAuthService.class);
        when(auth.verify("Bearer owner-a")).thenReturn(new SupabaseAuthService.VerifiedUser("owner-a", "a@example.com", Map.of("companyName", "Company A")));
        when(auth.verify("Bearer owner-b")).thenReturn(new SupabaseAuthService.VerifiedUser("owner-b", "b@example.com", Map.of("companyName", "Company B")));
        var client = mvc(auth);
        client.perform(put("/api/profile").header("Authorization", "Bearer owner-a").contentType(MediaType.APPLICATION_JSON)
                .content("{\"companyName\":\"Changed A\"}")).andExpect(status().isOk());
        client.perform(get("/api/profile").header("Authorization", "Bearer owner-b"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.companyName").value("Company B"))
                .andExpect(jsonPath("$.email").value("b@example.com")).andExpect(jsonPath("$.password").doesNotExist());
    }

    @Test void authConfigDoesNotPublishKeysAndDemoLoginIsGone() throws Exception {
        var client = mvc(noConfiguration());
        client.perform(get("/api/auth/config")).andExpect(status().isOk()).andExpect(jsonPath("$.provider").value("supabase"))
                .andExpect(jsonPath("$.configured").value(false)).andExpect(jsonPath("$.key").doesNotExist());
        client.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"demo@barberworkshop.dev\",\"password\":\"demo123\"}"))
                .andExpect(status().isServiceUnavailable());
    }
}
