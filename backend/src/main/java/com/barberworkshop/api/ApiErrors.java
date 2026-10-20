package com.barberworkshop.api;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;
import java.util.Map;

@RestControllerAdvice
public class ApiErrors {
    @ExceptionHandler(ResponseStatusException.class)
    ResponseEntity<Map<String, Object>> status(ResponseStatusException error) {
        return ResponseEntity.status(error.getStatusCode()).body(Map.of(
                "status", error.getStatusCode().value(),
                "message", error.getReason() == null ? "İstek tamamlanamadı." : error.getReason()));
    }
}
