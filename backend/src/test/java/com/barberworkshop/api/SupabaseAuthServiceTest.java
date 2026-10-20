package com.barberworkshop.api;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;
import java.util.Map;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class SupabaseAuthServiceTest {
    private MockRestServiceServer upstream;
    private SupabaseAuthService auth;
    private static final String URL = "https://barber-auth.test/auth/v1";

    @BeforeEach void setup() {
        var builder = RestClient.builder();
        upstream = MockRestServiceServer.bindTo(builder).build();
        auth = new SupabaseAuthService("https://barber-auth.test", "sb_publishable_test", builder);
    }

    @Test void loginUsesSupabasePasswordGrantAndReturnsRefreshSession() {
        upstream.expect(requestTo(URL + "/token?grant_type=password"))
                .andExpect(method(HttpMethod.POST)).andExpect(header("apikey", "sb_publishable_test"))
                .andExpect(content().json("{\"email\":\"user@example.com\",\"password\":\"passphrase\"}"))
                .andRespond(withSuccess("{\"access_token\":\"supabase-access\",\"refresh_token\":\"refresh\",\"expires_in\":3600}", MediaType.APPLICATION_JSON));
        var result = auth.login(Map.of("email", " USER@EXAMPLE.COM ", "password", "passphrase"));
        assertThat(result.token()).isEqualTo("supabase-access");
        assertThat(result.refreshToken()).isEqualTo("refresh");
        assertThat(result.verificationRequired()).isFalse();
        upstream.verify();
    }

    @Test void signupWithoutSessionRequiresEmailConfirmationAndDoesNotCreateLocalToken() {
        upstream.expect(requestTo(URL + "/signup"))
                .andExpect(content().json("{\"email\":\"user@example.com\",\"password\":\"passphrase\",\"data\":{\"companyName\":\"Barber\",\"contactPerson\":\"Example\",\"phone\":\"555\",\"taxOffice\":\"Office\",\"taxNumber\":\"000\"}}"))
                .andRespond(withSuccess("{\"id\":\"ee4e14c3-aa5a-4ead-99f1-7d02ff537af0\"}", MediaType.APPLICATION_JSON));
        var result = auth.register(Map.of("email", "user@example.com", "password", "passphrase",
                "companyName", "Barber", "contactPerson", "Example", "phone", "555", "taxOffice", "Office", "taxNumber", "000"));
        assertThat(result.verificationRequired()).isTrue();
        assertThat(result.token()).isEmpty();
        upstream.verify();
    }

    @Test void verifiesWithAuthServerAndDoesNotTrustMetadataForIdentity() {
        upstream.expect(requestTo(URL + "/user")).andExpect(header("Authorization", "Bearer client-token"))
                .andRespond(withSuccess("{\"id\":\"ee4e14c3-aa5a-4ead-99f1-7d02ff537af0\",\"email\":\"user@example.com\",\"email_confirmed_at\":\"2026-10-20T00:00:00Z\",\"user_metadata\":{\"companyName\":\"Barber\",\"id\":\"other-owner\",\"role\":\"admin\",\"password\":\"excluded\"}}", MediaType.APPLICATION_JSON));
        var user = auth.verify("Bearer client-token");
        assertThat(user.id()).isEqualTo("ee4e14c3-aa5a-4ead-99f1-7d02ff537af0");
        assertThat(user.metadata()).containsOnlyKeys("companyName");
        upstream.verify();
    }

    @Test void invalidTokenIsRejectedWithoutDemoFallback() {
        upstream.expect(requestTo(URL + "/user")).andRespond(withStatus(HttpStatus.UNAUTHORIZED)
                .contentType(MediaType.APPLICATION_JSON).body("{\"error_code\":\"bad_jwt\"}"));
        assertThatThrownBy(() -> auth.verify("Bearer demo-token")).isInstanceOfSatisfying(ResponseStatusException.class,
                e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED));
        upstream.verify();
    }

    @Test void anonymousOrUnconfirmedUsersCannotOpenThePanel() {
        upstream.expect(requestTo(URL + "/user")).andRespond(withSuccess(
                "{\"id\":\"ee4e14c3-aa5a-4ead-99f1-7d02ff537af0\",\"email\":\"user@example.com\",\"is_anonymous\":true}", MediaType.APPLICATION_JSON));
        assertThatThrownBy(() -> auth.verify("Bearer anonymous")).isInstanceOfSatisfying(ResponseStatusException.class,
                e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED));
    }

    @Test void refreshUsesRotatedSupabaseTokens() {
        upstream.expect(requestTo(URL + "/token?grant_type=refresh_token"))
                .andExpect(content().json("{\"refresh_token\":\"old-refresh\"}"))
                .andRespond(withSuccess("{\"access_token\":\"new-access\",\"refresh_token\":\"new-refresh\",\"expires_in\":3600}", MediaType.APPLICATION_JSON));
        var result = auth.refresh(Map.of("refreshToken", "old-refresh"));
        assertThat(result.refreshToken()).isEqualTo("new-refresh");
        upstream.verify();
    }

    @Test void missingConfigurationFailsClosed() {
        var missing = new SupabaseAuthService("", "", RestClient.builder());
        assertThat(missing.configured()).isFalse();
        assertThatThrownBy(() -> missing.login(Map.of("email", "user@example.com", "password", "demo123")))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE));
        assertThatThrownBy(() -> missing.verify(null)).isInstanceOfSatisfying(ResponseStatusException.class,
                e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED));
    }

    @Test void configurationRejectsHttpAndSecretKeys() {
        assertThatThrownBy(() -> new SupabaseAuthService("http://example.com", "sb_publishable_test", RestClient.builder()))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new SupabaseAuthService("https://example.com", "sb_secret_excluded", RestClient.builder()))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test void settingAPasswordRequiresServerVerifiedIdentityAndIsDelegatedToSupabase() {
        upstream.expect(requestTo(URL + "/user")).andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess("{\"id\":\"ee4e14c3-aa5a-4ead-99f1-7d02ff537af0\",\"email\":\"user@example.com\",\"email_confirmed_at\":\"2026-10-20T00:00:00Z\"}", MediaType.APPLICATION_JSON));
        upstream.expect(requestTo(URL + "/user")).andExpect(method(HttpMethod.PUT))
                .andExpect(header("Authorization", "Bearer invited-user"))
                .andExpect(content().json("{\"password\":\"new-passphrase\"}"))
                .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));
        auth.updatePassword("Bearer invited-user", Map.of("password", "new-passphrase"));
        upstream.verify();
    }

    @Test void passwordRecoveryUsesSupabaseAndDoesNotExposeAnAccountRecord() {
        upstream.expect(requestTo(URL + "/recover")).andExpect(method(HttpMethod.POST))
                .andExpect(content().json("{\"email\":\"user@example.com\"}"))
                .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));
        auth.recover(Map.of("email", "USER@EXAMPLE.COM"));
        upstream.verify();
    }
}
