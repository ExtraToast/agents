package com.jorisjonkers.personalstack.agents.flow

import com.jorisjonkers.personalstack.agents.IntegrationTestBase
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.context.ApplicationContext
import org.springframework.web.bind.annotation.ControllerAdvice
import org.springframework.web.bind.annotation.RestControllerAdvice

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

    @Test
    fun `prints exception-handling advice wiring`() {
        val commonsHandler =
            ctx.getBeanNamesForType(
                Class.forName("com.jorisjonkers.personalstack.common.web.GlobalExceptionHandler"),
            ).toList()

        val controllerAdvices =
            (
                ctx.getBeanNamesForAnnotation(RestControllerAdvice::class.java).toList() +
                    ctx.getBeanNamesForAnnotation(ControllerAdvice::class.java).toList()
            ).distinct()
                .map { name -> name to ctx.getBean(name).javaClass.name }

        val problemDetailsRelated =
            ctx.beanDefinitionNames.toList().filter {
                it.contains("problemDetails", ignoreCase = true) ||
                    it.contains("responseEntityExceptionHandler", ignoreCase = true) ||
                    it.contains("errorAttributes", ignoreCase = true)
            }

        val problemDetailsEnabled =
            ctx.environment.getProperty("spring.mvc.problemdetails.enabled")

        println("=== ADVICE-WIRING-DIAGNOSTIC START ===")
        println("commons GlobalExceptionHandler bean names: $commonsHandler")
        println("spring.mvc.problemdetails.enabled = $problemDetailsEnabled")
        println("@ControllerAdvice beans (name -> class):")
        controllerAdvices.forEach { (name, cls) -> println("  - $name -> $cls") }
        println("problem-details / error beans: $problemDetailsRelated")
        println("=== ADVICE-WIRING-DIAGNOSTIC END ===")
    }
}
