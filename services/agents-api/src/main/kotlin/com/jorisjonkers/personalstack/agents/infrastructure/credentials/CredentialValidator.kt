package com.jorisjonkers.personalstack.agents.infrastructure.credentials

import com.jorisjonkers.personalstack.agents.domain.model.AgentCredentialProvider
import org.springframework.stereotype.Component

enum class CredentialValidationResult {
    VALID,
    EXPLICIT_INVALID,
    UNKNOWN,
}

@Component
class CredentialValidator {
    @Suppress("UNUSED_PARAMETER")
    fun validate(
        provider: AgentCredentialProvider,
        payload: Map<String, String>,
    ): CredentialValidationResult = CredentialValidationResult.UNKNOWN

    fun fromHttpStatus(statusCode: Int): CredentialValidationResult =
        when (statusCode) {
            in 200..299 -> CredentialValidationResult.VALID
            401, 403 -> CredentialValidationResult.EXPLICIT_INVALID
            else -> CredentialValidationResult.UNKNOWN
        }
}
