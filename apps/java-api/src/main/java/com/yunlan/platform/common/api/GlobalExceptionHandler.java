package com.yunlan.platform.common.api;

import jakarta.validation.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {
    private static final Logger LOGGER = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ApiError> handleApiException(ApiException exception) {
        return ResponseEntity.status(exception.status())
                .body(ApiError.of(exception.code(), exception.getMessage(), exception.details()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException exception) {
        var fields = exception.getBindingResult().getFieldErrors().stream()
                .collect(java.util.stream.Collectors.toMap(
                        error -> error.getField(),
                        error -> error.getDefaultMessage() == null ? "invalid" : error.getDefaultMessage(),
                        (left, right) -> left
                ));
        return ResponseEntity.badRequest().body(ApiError.of(
                "VALIDATION_FAILED",
                "Request validation failed.",
                Map.of("fields", fields)
        ));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiError> handleMalformedRequest() {
        return ResponseEntity.badRequest().body(ApiError.of(
                "MALFORMED_REQUEST",
                "Request body must contain valid JSON."
        ));
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiError> handleConstraintViolation(ConstraintViolationException exception) {
        return ResponseEntity.badRequest().body(ApiError.of(
                "VALIDATION_FAILED",
                exception.getMessage()
        ));
    }

    @ExceptionHandler(ObjectOptimisticLockingFailureException.class)
    public ResponseEntity<ApiError> handleOptimisticLock() {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(ApiError.of(
                "VERSION_CONFLICT",
                "The record changed while the request was being processed. Reload and retry."
        ));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiError> handleDataIntegrity() {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(ApiError.of(
                "DATA_CONFLICT",
                "The request conflicts with existing data."
        ));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> handleUnexpected(Exception exception) {
        LOGGER.error("Unhandled API exception", exception);
        return ResponseEntity.internalServerError().body(ApiError.of(
                "INTERNAL_ERROR",
                "The service is temporarily unavailable."
        ));
    }
}
