package com.jorisjonkers.personalstack.agents.flow

import com.jorisjonkers.personalstack.agents.IntegrationTestBase
import com.jorisjonkers.personalstack.common.identity.CredentialSource
import com.jorisjonkers.personalstack.common.identity.ForwardAuthPrincipal
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.context.ApplicationContext
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.web.bind.annotation.ControllerAdvice
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.springframework.web.context.WebApplicationContext
import java.util.UUID

/**
 * Diagnostic: prints which exception-handling advices the full agents-api
 * application context actually registers, so we can see why
 * MethodArgumentNotValidException is mapped to 400 (Boot's built-in
 * ProblemDetails handler) instead of 422 (kotlin-commons-web
 * GlobalExceptionHandler) in the full context while standalone controller
 * tests get 422.
 */
class ExceptionAdviceWiringIntegrationTest : IntegrationTestBase() {
    @Autowired
    private lateinit var ctx: ApplicationContext

    @Autowired
    private lateinit var wac: WebApplicationContext

    @Test
    fun `prints exception-handling advice wiring`() {
        val mockMvc = MockMvcBuilders.webAppContextSetup(wac).build()
        val principalAttr =
            ForwardAuthPrincipal(
                userId = UUID.fromString("00000000-0000-0000-0000-000000000001"),
                roles = emptySet(),
                username = null,
                credentialSource = CredentialSource.EDGE_ASSERTION,
            )
        val result =
            mockMvc
                .perform(
                    org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .post("/api/v1/conversations")
                        .requestAttr(ForwardAuthPrincipal::class.java.name, principalAttr)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"\"}"),
                ).andReturn()
        val resolvedEx = result.resolvedException?.javaClass?.name
        val respStatus = result.response.status
        val respBody = result.response.contentAsString.take(400)

        val commonsType = Class.forName("com.jorisjonkers.personalstack.common.web.GlobalExceptionHandler")
        val commonsHandler = ctx.getBeanNamesForType(commonsType).toList()

        val restAdviceNames = ctx.getBeanNamesForAnnotation(RestControllerAdvice::class.java).toList()
        val adviceNames = ctx.getBeanNamesForAnnotation(ControllerAdvice::class.java).toList()
        val allAdviceNames = (restAdviceNames + adviceNames).distinct()
        val controllerAdvices = allAdviceNames.map { name -> name to ctx.getBean(name).javaClass.name }

        val allBeanNames = ctx.beanDefinitionNames.toList()
        val problemDetailsRelated =
            allBeanNames.filter { name ->
                name.contains("problemDetails", ignoreCase = true) ||
                    name.contains("responseEntityExceptionHandler", ignoreCase = true) ||
                    name.contains("errorAttributes", ignoreCase = true)
            }

        val problemDetailsEnabled =
            ctx.environment.getProperty("spring.mvc.problemdetails.enabled")

        val report =
            buildString {
                appendLine("ADVICE-WIRING:")
                appendLine("commonsGlobalExceptionHandlerBeans=$commonsHandler")
                appendLine("problemdetails.enabled=$problemDetailsEnabled")
                appendLine("controllerAdvices=" + controllerAdvices.joinToString("; ") { "${it.first}->${it.second}" })
                appendLine("problemDetailBeans=$problemDetailsRelated")
                appendLine("blankTitleStatus=$respStatus")
                appendLine("blankTitleResolvedException=$resolvedEx")
                appendLine("blankTitleBody=$respBody")
            }
        // Intentionally fail so the wiring report surfaces in the CI job log
        // (test stdout is not echoed to the gradle console). Removed once diagnosed.
        throw AssertionError(report)
    }
}
