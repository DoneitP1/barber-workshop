package com.barberworkshop.api;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.net.URI;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/** Supabase is the sole identity provider. No local password or demo-token fallback. */
@Service
public class SupabaseAuthService {
    private final String baseUrl;
    private final String publishableKey;
    private final RestClient client;
    private static final ObjectMapper JSON = new ObjectMapper();

    @org.springframework.beans.factory.annotation.Autowired
    public SupabaseAuthService(@Value("${supabase.url:}") String url,
                               @Value("${supabase.publishable-key:}") String key) {
        this(url, key, defaultClientBuilder());
    }

    SupabaseAuthService(String url, String key, RestClient.Builder builder) {
        baseUrl = url == null ? "" : url.trim().replaceAll("/+$", "");
        publishableKey = key == null ? "" : key.trim();
        if (!baseUrl.isEmpty()) {
            URI uri = URI.create(baseUrl);
            if (!"https".equals(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null
                    || uri.getQuery() != null || uri.getFragment() != null || !uri.getPath().isEmpty()) {
                throw new IllegalArgumentException("SUPABASE_URL must be an HTTPS project origin.");
            }
        }
        if (!publishableKey.isEmpty() && !publishableKey.startsWith("sb_publishable_")) {
            throw new IllegalArgumentException("SUPABASE_PUBLISHABLE_KEY must be a publishable key, never a secret/service-role key.");
        }
        client = builder.defaultHeader("apikey", publishableKey).build();
    }

    private static RestClient.Builder defaultClientBuilder() {
        var factory = new org.springframework.http.client.SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(8000);
        factory.setReadTimeout(10000);
        return RestClient.builder().requestFactory(factory);
    }

    public boolean configured() { return !baseUrl.isEmpty() && !publishableKey.isEmpty(); }

    public AuthResult login(Map<String, String> input) {
        String email = email(input);
        String password = required(input, "password", 128);
        return session(exchange(HttpMethod.POST, "/token?grant_type=password",
                Map.of("email", email, "password", password), null), false);
    }

    public AuthResult register(Map<String, String> input) {
        String email = email(input);
        String password = required(input, "password", 128);
        if (password.length() < 8) throw badRequest("Şifre en az 8 karakter olmalı.");
        Map<String, String> metadata = new LinkedHashMap<>();
        for (String field : new String[]{"companyName", "contactPerson", "phone", "taxOffice", "taxNumber"}) {
            metadata.put(field, required(input, field, 150).trim());
        }
        return session(exchange(HttpMethod.POST, "/signup",
                Map.of("email", email, "password", password, "data", metadata), null), true);
    }

    public AuthResult refresh(Map<String, String> input) {
        return session(exchange(HttpMethod.POST, "/token?grant_type=refresh_token",
                Map.of("refresh_token", required(input, "refreshToken", 4096)), null), false);
    }

    public VerifiedUser verify(String authorization) {
        String token = bearer(authorization);
        Map<String, Object> user = exchange(HttpMethod.GET, "/user", null, token);
        try {
            UUID id = UUID.fromString(String.valueOf(user.get("id")));
            String email = String.valueOf(user.getOrDefault("email", ""));
            if (email.isBlank() || !email.contains("@") || Boolean.TRUE.equals(user.get("is_anonymous"))
                    || user.get("email_confirmed_at") == null) throw new IllegalArgumentException();
            Map<String, String> metadata = new LinkedHashMap<>();
            // These values only populate editable display fields. Identity always comes from /user's id.
            if (user.get("user_metadata") instanceof Map<?, ?> data) {
                for (String field : new String[]{"companyName", "contactPerson", "phone", "taxOffice", "taxNumber"}) {
                    if (data.get(field) instanceof String value) metadata.put(field, value);
                }
            }
            return new VerifiedUser(id.toString(), email, Map.copyOf(metadata));
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Doğrulanmış bir hesapla giriş yapın.");
        }
    }

    public void logout(String authorization) {
        exchange(HttpMethod.POST, "/logout?scope=local", null, bearer(authorization));
    }

    public void recover(Map<String, String> input) {
        exchange(HttpMethod.POST, "/recover", Map.of("email", email(input)), null);
    }

    public void updatePassword(String authorization, Map<String, String> input) {
        verify(authorization);
        String password = required(input, "password", 128);
        if (password.length() < 8) throw badRequest("Şifre en az 8 karakter olmalı.");
        exchange(HttpMethod.PUT, "/user", Map.of("password", password), bearer(authorization));
    }

    private AuthResult session(Map<?, ?> data, boolean signup) {
        String token = data.get("access_token") instanceof String value ? value : "";
        if (token.isBlank()) {
            if (signup) return new AuthResult("", "", 0, true,
                    "E-posta adresinize gelen doğrulama bağlantısını açın. Ardından giriş yapabilirsiniz.");
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Supabase geçerli bir oturum döndürmedi.");
        }
        String refresh = data.get("refresh_token") instanceof String value ? value : "";
        long expires = data.get("expires_in") instanceof Number value ? value.longValue() : 3600;
        if (refresh.isBlank() || expires <= 0) throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Oturum bilgileri eksik.");
        return new AuthResult(token, refresh, expires, false, "");
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> exchange(HttpMethod method, String path, Object body, String bearer) {
        if (!configured()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "Supabase bağlantısı henüz yapılandırılmadı.");
        try {
            var request = client.method(method).uri(baseUrl + "/auth/v1" + path).accept(MediaType.APPLICATION_JSON);
            if (bearer != null) request.header("Authorization", "Bearer " + bearer);
            if (body != null) request.contentType(MediaType.APPLICATION_JSON).body(body);
            Map<String, Object> result = request.retrieve().body(Map.class);
            return result == null ? Map.of() : result;
        } catch (RestClientResponseException ex) {
            String code = "";
            try { code = String.valueOf(JSON.readValue(ex.getResponseBodyAsString(), Map.class).get("error_code")); }
            catch (Exception ignored) { /* Never relay upstream payloads, tokens or credentials to the UI. */ }
            if (ex.getStatusCode().value() == 429) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "Çok fazla deneme yaptınız. Biraz sonra tekrar deneyin.");
            if (code.equals("email_not_confirmed")) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,
                    "Giriş yapmadan önce e-posta adresinizi doğrulayın.");
            if (ex.getStatusCode().is5xxServerError()) throw unavailable();
            if (ex.getStatusCode().value() == 401 || ex.getStatusCode().value() == 403 || method == HttpMethod.GET || path.startsWith("/token") || path.startsWith("/logout"))
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Giriş bilgileri veya oturum geçersiz.");
            if (method == HttpMethod.PUT && path.equals("/user")) throw badRequest("Şifre güncellenemedi. Daha güçlü bir şifre deneyin.");
            throw badRequest("Kayıt tamamlanamadı. E-posta adresini ve şifrenizi kontrol edin.");
        } catch (RestClientException ex) { throw unavailable(); }
    }

    private ResponseStatusException unavailable() {
        return new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Supabase'e ulaşılamadı. Tekrar deneyin.");
    }
    private String bearer(String header) {
        if (header == null || !header.startsWith("Bearer ") || header.substring(7).isBlank())
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Devam etmek için giriş yapın.");
        return header.substring(7);
    }
    private String email(Map<String, String> input) {
        String value = required(input, "email", 254).trim().toLowerCase(java.util.Locale.ROOT);
        if (!value.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) throw badRequest("E-posta adresi geçersiz.");
        return value;
    }
    private String required(Map<String, String> input, String field, int maxLength) {
        String value = input.get(field);
        if (value == null || value.isBlank() || value.length() > maxLength) throw badRequest("Alanları kontrol edin.");
        return value;
    }
    private ResponseStatusException badRequest(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }
    public record VerifiedUser(String id, String email, Map<String, String> metadata) { }
    public record AuthResult(String token, String refreshToken, long expiresIn, boolean verificationRequired, String message) { }
}
