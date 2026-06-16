package com.jorisjonkers.personalstack.agents.config

import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.boot.web.servlet.FilterRegistrationBean
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.web.filter.OncePerRequestFilter
import java.nio.charset.StandardCharsets
import java.security.MessageDigest

@Configuration
class SecurityConfig {
    @Bean
    fun internalBearerFilterRegistration(
        props: AgentRuntimeProperties,
    ): FilterRegistrationBean<InternalBearerAuthFilter> =
        FilterRegistrationBean(InternalBearerAuthFilter(props.githubAppTokenBearer)).apply {
            addUrlPatterns("/api/v1/internal/*")
            order = 0
        }
}

/**
 * Guards the in-cluster `/api/v1/internal/` endpoints with a shared
 * bearer. Fail-closed: when no bearer is configured every request is
 * rejected, so an unconfigured deployment never exposes these
 * endpoints unauthenticated. The comparison is constant-time.
 */
class InternalBearerAuthFilter(
    configuredBearer: String,
) : OncePerRequestFilter() {
    private val expected: ByteArray? =
        configuredBearer.trim().takeIf { it.isNotEmpty() }?.toByteArray(StandardCharsets.UTF_8)

    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain,
    ) {
        if (expected == null) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Internal endpoint not configured")
            return
        }
        val presented =
            request
                .getHeader("Authorization")
                ?.removePrefix("Bearer ")
                ?.trim()
                ?.toByteArray(StandardCharsets.UTF_8)
        if (presented == null || !MessageDigest.isEqual(expected, presented)) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Invalid bearer")
            return
        }
        filterChain.doFilter(request, response)
    }
}
