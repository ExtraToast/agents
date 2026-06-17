package com.jorisjonkers.personalstack.agents.infrastructure.web

import com.jorisjonkers.personalstack.common.web.FieldError
import com.jorisjonkers.personalstack.common.web.ProblemDetail
import org.slf4j.MDC
import org.springframework.core.Ordered
import org.springframework.core.annotation.Order
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.springframework.web.context.request.WebRequest
import java.net.URI

/**
 * Maps bean-validation failures (`@Valid @RequestBody`) to a 422 ProblemDetail.
 *
 * In the full application context (Spring Security is on the classpath via the
 * identity module) the kotlin-commons-web `GlobalExceptionHandler` does not win
 * the `MethodArgumentNotValidException` mapping and the framework's default 400
 * is returned instead. This app-local advice at `HIGHEST_PRECEDENCE` — the same
 * pattern the other agents advices use — restores the 422 validation contract.
 * Standalone controller-slice tests already exercise the 422 mapping; this keeps
 * the full-context (integration) behaviour consistent with it.
 */
@RestControllerAdvice
@Order(Ordered.HIGHEST_PRECEDENCE)
class ValidationExceptionHandler {
    @ExceptionHandler(MethodArgumentNotValidException::class)
    fun handle(
        ex: MethodArgumentNotValidException,
        request: WebRequest?,
    ): ResponseEntity<ProblemDetail> {
        val traceId = MDC.get("traceId") ?: MDC.get("trace_id")
        val path =
            runCatching {
                request?.getDescription(false)?.removePrefix("uri=")?.takeIf { it.isNotBlank() }
            }.getOrNull()
        val fieldErrors =
            ex.bindingResult.fieldErrors.map { error ->
                FieldError(
                    field = error.field,
                    message = error.defaultMessage ?: "Invalid value",
                    rejectedValue = error.rejectedValue,
                )
            }
        val body =
            ProblemDetail(
                type = URI.create("urn:problem-type:validation-error"),
                title = "Validation Error",
                status = HttpStatus.UNPROCESSABLE_ENTITY.value(),
                detail = "One or more fields failed validation",
                instance = path?.let(URI::create),
                errors = fieldErrors,
                traceId = traceId,
            )
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).body(body)
    }
}
